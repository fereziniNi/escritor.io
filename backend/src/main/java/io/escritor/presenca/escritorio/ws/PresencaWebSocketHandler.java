package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.service.LocalizadorZona;
import io.escritor.presenca.escritorio.service.RegistroEventoPresencaService;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PRD §5/§3.5: handler puro (sem STOMP), mesmo espírito de {@code ProjetoWebSocketHandler}
 * (kanban, S3.11), mas global - não há "sala"/id de recurso aqui, só um canal único de presença
 * pra todo mundo autenticado. Estado vivo (posição, status) fica só neste mapa em memória, nunca
 * no banco (PRD). Conectar registra o usuário com posição inicial (0,0) e status
 * {@code DISPONIVEL}, e devolve pra ele mesmo um snapshot de todo mundo presente (incluindo
 * ele); desconectar NÃO remove o usuário do estado - marca {@code OFFLINE} e move a posição pro
 * centro da zona "Fora do trabalho" ({@link TipoZona#LIVRE}), pra o avatar continuar visível
 * (estacionado, parado) pros demais até a pessoa reconectar, em vez de sumir sem explicação (ver
 * {@link #afterConnectionClosed}). Mensagem recebida do cliente agora tem um
 * discriminador {@code tipo} ({@code POSICAO} ou {@code STATUS}, S6.6) - só passou a valer a pena
 * a partir de um segundo tipo de mensagem de entrada; até S6.4 movimento era o único.
 *
 * <p>S6.7 (PRD: "entrar numa sala atualiza meu status automaticamente, sala de Foco → status
 * Foco"): entrar numa zona cujo {@link TipoZona} tem o mesmo nome de um {@link StatusAvatar}
 * (hoje só {@code FOCO} e {@code REUNIAO} - {@code CAFE}/{@code ATENDIMENTO} não têm status
 * correspondente e por isso não disparam nada, {@code LIVRE} também não) troca o status
 * automaticamente; sair da zona restaura o status de antes de entrar, a menos que o usuário
 * tenha trocado de status manualmente enquanto estava dentro - {@link #rastreioPorUsuario} guarda
 * esse "status pra restaurar" por usuário, e fica {@code null} assim que uma troca manual
 * acontece dentro da zona, o que faz {@link #tratarPosicao} não restaurar mais nada na saída.
 *
 * <p>S6.8 (PRD: {@code AUSENTE} é automático após 5 minutos sem input): {@link
 * #verificarInatividade(Instant)} varre {@link #ultimaAtividadePorUsuario} - atualizada em
 * qualquer mensagem recebida e na conexão - e força {@code AUSENTE} em quem passou do limiar,
 * marcando em {@link #ausenteAutomaticoUsuarios} que foi o timeout (não uma escolha manual) que
 * fez isso. Qualquer mensagem nova desse usuário (posição ou status) tira ele do {@code AUSENTE}
 * automático de volta pra {@code DISPONIVEL} antes de processar o resto da mensagem - ver {@link
 * #sairDeAusenciaAutomaticaSeNecessario}.
 *
 * <p>S6.12 (PRD §3.5, opcional): {@link #eventoZonaAtualPorUsuario} rastreia em qual zona (sem
 * filtro de status - qualquer uma, diferente de {@link #rastreioPorUsuario}/S6.7) cada usuário
 * está, só pra saber quando gravar um {@code EventoPresenca} via {@link
 * RegistroEventoPresencaService}. Essa escrita sempre acontece *depois* do {@link
 * #broadcast(PresencaEventoWs)} de posição/status - nunca antes - pra nunca atrasar a resposta em
 * tempo real pros clientes conectados (PRD).
 */
@Component
public class PresencaWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresencaWebSocketHandler.class);
    private static final Duration LIMIAR_INATIVIDADE = Duration.ofMinutes(5);

    private final Map<Long, WebSocketSession> sessoesPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, EstadoPresencaUsuario> estadoPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, RastreioZona> rastreioPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, Instant> ultimaAtividadePorUsuario = new ConcurrentHashMap<>();
    private final Set<Long> ausenteAutomaticoUsuarios = ConcurrentHashMap.newKeySet();
    private final Map<Long, Long> eventoZonaAtualPorUsuario = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final ValidadorPosicaoMapa validadorPosicaoMapa;
    private final LocalizadorZona localizadorZona;
    private final RegistroEventoPresencaService registroEventoPresencaService;
    private final Clock clock;

    public PresencaWebSocketHandler(
            ObjectMapper objectMapper,
            ValidadorPosicaoMapa validadorPosicaoMapa,
            LocalizadorZona localizadorZona,
            RegistroEventoPresencaService registroEventoPresencaService,
            Clock clock) {
        this.objectMapper = objectMapper;
        this.validadorPosicaoMapa = validadorPosicaoMapa;
        this.localizadorZona = localizadorZona;
        this.registroEventoPresencaService = registroEventoPresencaService;
        this.clock = clock;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long usuarioId = usuarioId(session);
        String nome = (String) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_NOME);
        AparenciaAvatar aparencia = (AparenciaAvatar) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_APARENCIA);

        estadoPorUsuario.put(usuarioId, new EstadoPresencaUsuario(usuarioId, nome, 0, 0, StatusAvatar.DISPONIVEL, aparencia));
        sessoesPorUsuario.put(usuarioId, session);
        ultimaAtividadePorUsuario.put(usuarioId, Instant.now(clock));

        enviar(session, new PresencaEventoWs("SNAPSHOT", List.copyOf(estadoPorUsuario.values())));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long usuarioId = usuarioId(session);
        sessoesPorUsuario.remove(usuarioId);
        rastreioPorUsuario.remove(usuarioId);
        ultimaAtividadePorUsuario.remove(usuarioId);
        ausenteAutomaticoUsuarios.remove(usuarioId);

        estacionarComoOffline(usuarioId);

        Long zonaAberta = eventoZonaAtualPorUsuario.remove(usuarioId);
        if (zonaAberta != null) {
            registroEventoPresencaService.registrarTransicaoDeZona(usuarioId, zonaAberta, null, Instant.now(clock));
        }
    }

    /**
     * Move quem acabou de desconectar pro centro de "Fora do trabalho" com status {@code OFFLINE},
     * em vez de remover do estado - o avatar continua visível pros demais (parado, "estacionado")
     * até a pessoa reconectar, quando {@link #afterConnectionEstablished} sobrescreve essa entrada
     * de novo com posição (0,0) e {@code DISPONIVEL}. Sem zona "Fora do trabalho" seedada (não
     * deveria acontecer em produção), mantém a última posição conhecida - só troca o status.
     * Não abre um novo {@code EventoPresenca} pra essa posição sintética: é só um "estacionamento"
     * visual, não uma visita de verdade à sala.
     */
    private void estacionarComoOffline(Long usuarioId) {
        EstadoPresencaUsuario atual = estadoPorUsuario.get(usuarioId);
        if (atual == null) {
            return;
        }
        Optional<Zona> zonaForaDoTrabalho = localizadorZona.zonaPorTipo(TipoZona.LIVRE);
        int x = zonaForaDoTrabalho.map(zona -> zona.getX() + zona.getLargura() / 2).orElse(atual.x());
        int y = zonaForaDoTrabalho.map(zona -> zona.getY() + zona.getAltura() / 2).orElse(atual.y());
        EstadoPresencaUsuario offline = new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), x, y, StatusAvatar.OFFLINE, atual.aparencia());
        estadoPorUsuario.put(usuarioId, offline);
        broadcast(new PresencaEventoWs("STATUS", List.of(offline)));
    }

    /**
     * Dispara a cada 30s de tempo real (intervalo de checagem, não o limiar em si - esse é
     * {@link #LIMIAR_INATIVIDADE}) via {@code @Scheduled}; a versão com parâmetro existe separada
     * pra ser testável sem depender de tempo de parede de verdade (mesmo espírito de {@code
     * EstadoDia.calcular} receber {@code agora} em vez de chamar {@code Instant.now()} sozinho).
     */
    @Scheduled(fixedRate = 30_000)
    public void verificarInatividade() {
        verificarInatividade(Instant.now(clock));
    }

    public void verificarInatividade(Instant agora) {
        estadoPorUsuario.forEach((usuarioId, estadoAtual) -> {
            // OFFLINE nunca é revertido por inatividade - só volta a algo quando a pessoa reconecta
            // de verdade (afterConnectionEstablished); sem sessão aberta pra esse usuarioId,
            // ultimaAtividadePorUsuario também já está vazio, então isso é defensivo, não o único
            // motivo de pular.
            if (estadoAtual.status() == StatusAvatar.AUSENTE || estadoAtual.status() == StatusAvatar.OFFLINE) {
                return;
            }
            Instant ultimaAtividade = ultimaAtividadePorUsuario.get(usuarioId);
            if (ultimaAtividade == null || Duration.between(ultimaAtividade, agora).compareTo(LIMIAR_INATIVIDADE) < 0) {
                return;
            }

            EstadoPresencaUsuario atualizado = new EstadoPresencaUsuario(
                    estadoAtual.usuarioId(), estadoAtual.nome(), estadoAtual.x(), estadoAtual.y(), StatusAvatar.AUSENTE, estadoAtual.aparencia());
            estadoPorUsuario.put(usuarioId, atualizado);
            ausenteAutomaticoUsuarios.add(usuarioId);
            // zera o rastreio de zona: se a pessoa acordar sem sair do lugar, precisa ser tratado
            // como uma "entrada" nova na zona pra recalcular o status certo, não como "nada mudou"
            rastreioPorUsuario.remove(usuarioId);
            broadcast(new PresencaEventoWs("STATUS", List.of(atualizado)));
        });
    }

    /**
     * Payload malformado, tipo desconhecido, posição fora dos limites do mapa ou status
     * desconhecido é silenciosamente ignorado - o cliente nunca é fonte de verdade sobre posição
     * (PRD), e uma sessão instável/maliciosa mandando lixo não derruba a conexão nem afeta os
     * demais. Não existe (nem pode existir, {@link ComandoWs} não tem esse campo) jeito do cliente
     * dizer *de quem* é o status/posição sendo alterado - é sempre a própria sessão autenticada no
     * handshake, então "usuário altera status de outro" não é uma checagem que precisa ser feita,
     * é uma ação que a mensagem não sabe nem expressar.
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ComandoWs comando;
        try {
            comando = objectMapper.readValue(message.getPayload(), ComandoWs.class);
        } catch (Exception e) {
            return;
        }

        Long usuarioId = usuarioId(session);
        ultimaAtividadePorUsuario.put(usuarioId, Instant.now(clock));
        sairDeAusenciaAutomaticaSeNecessario(usuarioId);

        if ("POSICAO".equals(comando.tipo())) {
            tratarPosicao(session, comando);
        } else if ("STATUS".equals(comando.tipo())) {
            tratarStatus(session, comando);
        }
    }

    /**
     * Qualquer mensagem (mesmo uma posição inválida ou um status desconhecido, que
     * {@link #tratarPosicao}/{@link #tratarStatus} vão rejeitar em seguida) já conta como "voltou"
     * - é atividade de verdade vinda do cliente, independente do conteúdo ser aceito depois.
     */
    private void sairDeAusenciaAutomaticaSeNecessario(Long usuarioId) {
        if (!ausenteAutomaticoUsuarios.remove(usuarioId)) {
            return;
        }
        EstadoPresencaUsuario atual = estadoPorUsuario.get(usuarioId);
        if (atual == null || atual.status() != StatusAvatar.AUSENTE) {
            return;
        }
        EstadoPresencaUsuario atualizado =
                new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), atual.x(), atual.y(), StatusAvatar.DISPONIVEL, atual.aparencia());
        estadoPorUsuario.put(usuarioId, atualizado);
        broadcast(new PresencaEventoWs("STATUS", List.of(atualizado)));
    }

    private void tratarPosicao(WebSocketSession session, ComandoWs comando) {
        if (comando.x() == null || comando.y() == null || !validadorPosicaoMapa.dentroDosLimites(comando.x(), comando.y())) {
            return;
        }

        Long usuarioId = usuarioId(session);
        atualizarEstado(usuarioId, atual -> {
            StatusAvatar novoStatus = resolverStatusAposMover(usuarioId, atual.status(), comando.x(), comando.y());
            return new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), comando.x(), comando.y(), novoStatus, atual.aparencia());
        }).ifPresent(atualizado -> {
            broadcast(new PresencaEventoWs("POSICAO", List.of(atualizado)));
            // sempre depois do broadcast acima - a resposta em tempo real pros clientes conectados
            // já saiu antes dessa escrita começar (PRD, S6.12)
            registrarEventoPresencaSeMudouDeZona(usuarioId, comando.x(), comando.y());
        });
    }

    private void registrarEventoPresencaSeMudouDeZona(Long usuarioId, int x, int y) {
        Long zonaAlvoId = localizadorZona.zonaContendo(x, y).map(Zona::getId).orElse(null);
        Long zonaAnteriorId = eventoZonaAtualPorUsuario.get(usuarioId);
        if (Objects.equals(zonaAnteriorId, zonaAlvoId)) {
            return;
        }

        if (zonaAlvoId == null) {
            eventoZonaAtualPorUsuario.remove(usuarioId);
        } else {
            eventoZonaAtualPorUsuario.put(usuarioId, zonaAlvoId);
        }
        registroEventoPresencaService.registrarTransicaoDeZona(usuarioId, zonaAnteriorId, zonaAlvoId, Instant.now(clock));
    }

    /**
     * Só reage a zonas com status correspondente (ver javadoc da classe) - entrar/sair de uma
     * zona sem status (CAFE, ATENDIMENTO, LIVRE) não é rastreado, então não interfere em nada.
     */
    private StatusAvatar resolverStatusAposMover(Long usuarioId, StatusAvatar statusAtual, int x, int y) {
        Optional<Zona> zonaAlvo = localizadorZona.zonaContendo(x, y);
        Optional<StatusAvatar> statusDaZonaAlvo = zonaAlvo.flatMap(zona -> statusAutomaticoPara(zona.getTipo()));
        Long zonaAlvoId = statusDaZonaAlvo.isPresent() ? zonaAlvo.get().getId() : null;

        RastreioZona rastreioAtual = rastreioPorUsuario.get(usuarioId);
        Long zonaAnteriorId = rastreioAtual == null ? null : rastreioAtual.zonaId();
        if (Objects.equals(zonaAnteriorId, zonaAlvoId)) {
            return statusAtual;
        }

        StatusAvatar statusAoSair = rastreioAtual != null && rastreioAtual.statusAntesDaZona() != null
                ? rastreioAtual.statusAntesDaZona()
                : statusAtual;

        if (statusDaZonaAlvo.isEmpty()) {
            rastreioPorUsuario.remove(usuarioId);
            return statusAoSair;
        }

        rastreioPorUsuario.put(usuarioId, new RastreioZona(zonaAlvoId, statusAoSair));
        return statusDaZonaAlvo.get();
    }

    private static Optional<StatusAvatar> statusAutomaticoPara(TipoZona tipoZona) {
        try {
            return Optional.of(StatusAvatar.valueOf(tipoZona.name()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private void tratarStatus(WebSocketSession session, ComandoWs comando) {
        StatusAvatar novoStatus;
        try {
            novoStatus = StatusAvatar.valueOf(comando.status());
        } catch (Exception e) {
            return;
        }

        Long usuarioId = usuarioId(session);
        atualizarEstado(usuarioId, atual -> new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), atual.x(), atual.y(), novoStatus, atual.aparencia()))
                .ifPresent(atualizado -> {
                    // troca manual dentro de uma zona rastreada invalida o "restaurar ao sair" (S6.7) -
                    // a escolha agora é do usuário, não mais um efeito automático da zona
                    rastreioPorUsuario.computeIfPresent(usuarioId, (id, rastreio) -> new RastreioZona(rastreio.zonaId(), null));
                    broadcast(new PresencaEventoWs("STATUS", List.of(atualizado)));
                });
    }

    /**
     * Pedido do usuário: "a opção para todos detalhar da melhor maneira possível o avatar" -
     * chamado por {@code UsuarioService#atualizarMinhaAparencia} (fora do fluxo de WebSocket, via
     * REST) depois de salvar no banco, pra quem já está conectado no mapa ver a aparência nova do
     * colega sem precisar reconectar. Sem efeito (silencioso) se o usuário não está conectado
     * agora - a aparência já foi salva de qualquer forma, só não há ninguém no mapa pra avisar.
     */
    public void atualizarAparencia(Long usuarioId, AparenciaAvatar novaAparencia) {
        atualizarEstado(
                        usuarioId,
                        atual -> new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), atual.x(), atual.y(), atual.status(), novaAparencia))
                .ifPresent(atualizado -> broadcast(new PresencaEventoWs("APARENCIA", List.of(atualizado))));
    }

    private Optional<EstadoPresencaUsuario> atualizarEstado(Long usuarioId, UnaryOperator<EstadoPresencaUsuario> atualizar) {
        EstadoPresencaUsuario atual = estadoPorUsuario.get(usuarioId);
        if (atual == null) {
            return Optional.empty();
        }
        EstadoPresencaUsuario atualizado = atualizar.apply(atual);
        estadoPorUsuario.put(usuarioId, atualizado);
        return Optional.of(atualizado);
    }

    private void enviar(WebSocketSession sessao, PresencaEventoWs evento) {
        enviarMensagem(sessao, new TextMessage(objectMapper.writeValueAsString(evento)));
    }

    private void broadcast(PresencaEventoWs evento) {
        TextMessage mensagem = new TextMessage(objectMapper.writeValueAsString(evento));
        for (WebSocketSession sessao : sessoesPorUsuario.values()) {
            enviarMensagem(sessao, mensagem);
        }
    }

    /**
     * {@code isOpen()} não é garantia contra uma corrida - a sessão pode fechar entre essa
     * checagem e o {@code sendMessage} de verdade (mais provável agora que {@link
     * #estacionarComoOffline} passou a fazer {@link #broadcast} bem no meio de outra sessão
     * fechando, S6.x). O Tomcat sinaliza isso com {@link IllegalStateException}, não {@link
     * IOException} - sem esse catch aqui, uma sessão flakada no meio de {@link
     * #sessoesPorUsuario}{@code .values()} abortava o loop de {@link #broadcast} inteiro e ninguém
     * depois dela recebia o evento.
     */
    private void enviarMensagem(WebSocketSession sessao, TextMessage mensagem) {
        if (!sessao.isOpen()) {
            return;
        }
        try {
            sessao.sendMessage(mensagem);
        } catch (IOException | IllegalStateException e) {
            log.warn("Falha ao enviar evento de presença pra sessão {}", sessao.getId(), e);
        }
    }

    private Long usuarioId(WebSocketSession session) {
        return (Long) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_USUARIO_ID);
    }

    private record PresencaEventoWs(String tipo, List<EstadoPresencaUsuario> usuarios) {
    }

    private record ComandoWs(String tipo, Integer x, Integer y, String status) {
    }

    /**
     * {@code statusAntesDaZona} nulo significa "não restaurar nada ao sair" - ou porque o usuário
     * trocou de status manualmente enquanto estava dentro da zona (S6.7), ou porque a zona nunca
     * teve um status pra guardar em primeiro lugar (não deveria acontecer - só criamos este
     * registro quando {@code statusDaZonaAlvo} está presente).
     */
    private record RastreioZona(Long zonaId, StatusAvatar statusAntesDaZona) {
    }
}
