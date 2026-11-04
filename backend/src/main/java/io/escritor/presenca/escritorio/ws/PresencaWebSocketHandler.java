package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.service.LocalizadorZona;
import io.escritor.presenca.escritorio.service.RegistroEventoPresencaService;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PRD §5/§3.5: handler puro (sem STOMP), mesmo espírito de {@code ProjetoWebSocketHandler}
 * (kanban, S3.11), mas global - não há "sala"/id de recurso aqui, só um canal único de presença
 * pra todo mundo autenticado. Estado vivo (posição, status) fica só neste mapa em memória, nunca
 * no banco (PRD). Conectar registra o usuário com posição inicial (0,0) e status
 * {@code DISPONIVEL}, e devolve pra ele mesmo um snapshot de todo mundo presente (incluindo
 * ele); desconectar NÃO remove o usuário do estado - marca {@code OFFLINE} exatamente onde a
 * pessoa estava (pedido do usuário: "se a pessoa ficar 5 horas no mesmo lugar... não coloque ela
 * para o lugar de descanso/fora do trabalho" - nenhum teleporte, só troca de status), pra o avatar
 * continuar visível (apagado, parado) pros demais até a pessoa reconectar, em vez de sumir sem
 * explicação (ver {@link #afterConnectionClosed}). Mensagem recebida do cliente agora tem um
 * discriminador {@code tipo} ({@code POSICAO} ou {@code STATUS}, S6.6) - só passou a valer a pena
 * a partir de um segundo tipo de mensagem de entrada; até S6.4 movimento era o único.
 *
 * <p>S6.7 (PRD: "entrar numa sala atualiza meu status automaticamente, sala de Foco → status
 * Foco"): entrar em QUALQUER zona troca o status automaticamente - pedido posterior do usuário:
 * "independente de qual sala seja, atualize o status". O mapa zona→status é {@link
 * #STATUS_POR_ZONA} (começou só com {@code FOCO}/{@code REUNIAO}, agora cobre todo {@link
 * TipoZona}). Sair da zona restaura o status de antes de entrar, a menos que o usuário tenha
 * trocado de status manualmente enquanto estava dentro - {@link #rastreioPorUsuario} guarda esse
 * "status pra restaurar" por usuário, e fica {@code null} assim que uma troca manual acontece
 * dentro da zona, o que faz {@link #tratarPosicao} não restaurar mais nada na saída.
 *
 * <p>S6.8 removido (pedido do usuário: "a pessoa não deve ir para a sala de 'off' se ela ficar
 * inativa na página. Não faça isso.") - existia um {@code AUSENTE} automático depois de 5 minutos
 * sem input (PRD), mas como {@code AUSENTE} é semanticamente ligado a "Fora do trabalho" ({@link
 * #STATUS_POR_ZONA}, mesma tela que mostra o status), o efeito prático incomodava mais do que
 * ajudava. O único jeito de virar {@code AUSENTE} hoje é a pessoa escolher esse status na mão (ou
 * andar até a zona "Fora do trabalho" - {@link #resolverStatusAposMover}), nunca por ficar parada.
 *
 * <p>S6.12 (PRD §3.5, opcional): {@link #eventoZonaAtualPorUsuario} rastreia em qual zona (sem
 * filtro de status - qualquer uma, diferente de {@link #rastreioPorUsuario}/S6.7) cada usuário
 * está, só pra saber quando gravar um {@code EventoPresenca} via {@link
 * RegistroEventoPresencaService}. Essa escrita sempre acontece *depois* do {@link
 * #broadcast(PresencaEventoWs)} de posição/status - nunca antes - pra nunca atrasar a resposta em
 * tempo real pros clientes conectados (PRD).
 *
 * <p>Pedido do usuário: "não estou vendo meus colegas, mesmo offline nenhum deles está
 * aparecendo... a movimentação e presença deve ser TUDO AO VIVO" - ver {@link #semearColegasNoBoot}
 * pra causa raiz e correção (colega que nunca conectou nesta execução do servidor simplesmente não
 * existia no mapa em memória).
 */
@Component
public class PresencaWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresencaWebSocketHandler.class);

    /**
     * Pedido do usuário: "gostaria que o status fosse atualizado assim que o personagem entrasse na
     * sala, independente de qual sala seja". Antes só entrar numa zona cujo {@link TipoZona} tinha
     * o mesmo nome de um {@link StatusAvatar} (só {@code FOCO}/{@code REUNIAO}) trocava o status; as
     * outras (Café, Fora do trabalho, Happy Hour, Cabine, Atendimento) não mexiam em nada. Agora
     * todo tipo de zona mapeia pra um status, com uma exceção. Os "não óbvios": Café/Happy Hour →
     * {@code ALMOCO} (pausa), Cabine → {@code FOCO} (cabine de concentração), Atendimento (nenhuma
     * zona seedada usa hoje) → {@code DISPONIVEL}. Sair da zona ainda restaura o status de antes de
     * entrar (ver {@link #resolverStatusAposMover}).
     *
     * <p>Exceção: {@code TipoZona.LIVRE} ("Fora do trabalho") de propósito NÃO está aqui. Pedido do
     * usuário: "ele nunca deve redirecionar para ausente a menos que ele escolha essa opção" - só
     * andar até essa sala não é uma escolha de status, é só andar; virar {@code AUSENTE}
     * automaticamente só por estar naquele tile de propósito incomodava do mesmo jeito que os
     * outros dois gatilhos automáticos de {@code AUSENTE} já removidos nesta sessão (inatividade,
     * desconexão). O único caminho pra {@code AUSENTE} continua existindo: escolher esse status na
     * mão no seletor (aí sim {@code calcularDestinoParaStatus} no front-end leva a pessoa até essa
     * sala - decisão dela, não automática). {@code PresencaWebSocketHandlerTest} garante que todo
     * valor de {@link TipoZona} MENOS {@code LIVRE} está aqui.
     */
    static final Map<TipoZona, StatusAvatar> STATUS_POR_ZONA = Map.of(
            TipoZona.FOCO, StatusAvatar.FOCO,
            TipoZona.REUNIAO, StatusAvatar.REUNIAO,
            TipoZona.CAFE, StatusAvatar.ALMOCO,
            TipoZona.HAPPY_HOUR, StatusAvatar.ALMOCO,
            TipoZona.CABINE, StatusAvatar.FOCO,
            TipoZona.ATENDIMENTO, StatusAvatar.DISPONIVEL);

    private final Map<Long, WebSocketSession> sessoesPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, EstadoPresencaUsuario> estadoPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, RastreioZona> rastreioPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, Long> eventoZonaAtualPorUsuario = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final ValidadorPosicaoMapa validadorPosicaoMapa;
    private final LocalizadorZona localizadorZona;
    private final RegistroEventoPresencaService registroEventoPresencaService;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public PresencaWebSocketHandler(
            ObjectMapper objectMapper,
            ValidadorPosicaoMapa validadorPosicaoMapa,
            LocalizadorZona localizadorZona,
            RegistroEventoPresencaService registroEventoPresencaService,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.objectMapper = objectMapper;
        this.validadorPosicaoMapa = validadorPosicaoMapa;
        this.localizadorZona = localizadorZona;
        this.registroEventoPresencaService = registroEventoPresencaService;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    /** Só pra teste ({@code PresencaWebSocketIT}): zera todo o estado em memória entre um método e
     * outro. O bean é singleton e o contexto Spring é reaproveitado entre os testes da classe -
     * sem isso, um broadcast de {@code OFFLINE} disparado por um {@code close()} de sessão do teste
     * anterior (o fechamento do WebSocket é assíncrono) vaza pra fila de mensagens do teste
     * seguinte, deixando o {@code PresencaWebSocketIT} flaky. */
    void limparEstadoParaTeste() {
        sessoesPorUsuario.clear();
        estadoPorUsuario.clear();
        rastreioPorUsuario.clear();
        eventoZonaAtualPorUsuario.clear();
    }

    /**
     * Achado num relato do usuário: "não estou vendo meus colegas, mesmo offline nenhum deles está
     * aparecendo... a movimentação e presença deve ser TUDO AO VIVO". Causa raiz: {@link
     * #estadoPorUsuario} só ganhava uma entrada pra um usuário quando ELE MESMO conectava em
     * {@code /ws/presenca} pelo menos uma vez desde que o processo do backend subiu (estado vivo,
     * só em memória, nunca no banco - PRD) - um colega que ainda não tivesse aberto o Escritório
     * nesta execução do servidor (ex.: logo depois de um deploy/restart, que zera {@link
     * #estadoPorUsuario} inteiro) simplesmente não existia no mapa, então nunca aparecia pra
     * ninguém, nem como OFFLINE.
     *
     * <p>Preenche {@link #estadoPorUsuario} com um placeholder {@code OFFLINE} (mesma posição
     * "estacionada" de {@link #estacionarComoOffline}) pra todo usuário ativo do banco, uma vez, no
     * boot da aplicação ({@code ApplicationReadyEvent} - dispara depois do Flyway/schema estarem
     * prontos, antes do Tomcat aceitar a primeira conexão de verdade) - não em {@code
     * afterConnectionEstablished}. Achado testando: consultar o banco ali (no caminho crítico de
     * CADA conexão) somava uma latência real, sujeita ao custo de "primeira chamada" do Hibernate
     * (geração de proxy via ByteBuddy) - pequena em produção, mas grande o bastante pra estourar os
     * timeouts de 5s do {@code PresencaWebSocketIT} nos primeiros testes da classe (achado ao vivo:
     * as mesmas ~7 falhas se repetiam de forma determinística entre execuções, não era
     * flakiness aleatória). Rodar uma vez no boot paga esse custo durante a inicialização do
     * contexto Spring (fora de qualquer janela cronometrada, de teste ou de usuário de verdade) e
     * deixa {@code afterConnectionEstablished} exatamente tão rápido quanto antes desta correção -
     * o snapshot da primeira pessoa a conectar depois de um deploy já vem completo, sem custo
     * extra por conexão.
     */
    @EventListener(ApplicationReadyEvent.class)
    void semearColegasNoBoot() {
        PosicaoXY posicaoOffline = posicaoForaDoTrabalho(0, 0);
        for (Usuario usuario : usuarioRepository.findByAtivoTrueOrderByNomeAsc()) {
            estadoPorUsuario.putIfAbsent(
                    usuario.getId(),
                    new EstadoPresencaUsuario(
                            usuario.getId(), usuario.getNome(), posicaoOffline.x(), posicaoOffline.y(), StatusAvatar.OFFLINE,
                            usuario.getAparencia()));
        }
    }

    /**
     * Pedido do usuário: "toda hora o personagem está voltando para o marco zero da tela... ele
     * deve estar sempre na posição que está" - antes, TODA conexão (inclusive uma reconexão depois
     * de uma queda de rede, célular dormindo, ou o backend redeployar) jogava a posição de volta
     * pra {@code (0,0)} incondicionalmente, não só na primeira vez. Se já existe uma entrada pra
     * esse usuário em {@link #estadoPorUsuario} (reconectando depois de cair, ou estacionado
     * {@code OFFLINE} por {@link #estacionarComoOffline}/{@link #semearColegasNoBoot}), reaproveita
     * a posição dela em vez de sobrescrever - só quem nunca teve entrada nenhuma (primeira conexão
     * de verdade) nasce em {@code (0,0)}. Ver também {@link #enviarPing}, que ataca a causa mais
     * comum de reconexão desnecessária (o proxy/plataforma derrubando a conexão por ela ficar
     * "quieta" tempo demais sem a pessoa se mexer).
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long usuarioId = usuarioId(session);
        String nome = (String) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_NOME);
        AparenciaAvatar aparencia = (AparenciaAvatar) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_APARENCIA);

        EstadoPresencaUsuario existente = estadoPorUsuario.get(usuarioId);
        int x = existente != null ? existente.x() : 0;
        int y = existente != null ? existente.y() : 0;

        estadoPorUsuario.put(usuarioId, new EstadoPresencaUsuario(usuarioId, nome, x, y, StatusAvatar.DISPONIVEL, aparencia));
        sessoesPorUsuario.put(usuarioId, session);

        enviar(session, new PresencaEventoWs("SNAPSHOT", List.copyOf(estadoPorUsuario.values())));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long usuarioId = usuarioId(session);
        // Reconexão (queda de rede, aba suspensa, 2ª aba): a sessão nova já substituiu esta em
        // `sessoesPorUsuario` antes do close da antiga chegar. Se a antiga marcasse OFFLINE aqui,
        // a pessoa apareceria offline para todos mesmo conectada.
        if (!sessoesPorUsuario.remove(usuarioId, session)) {
            return;
        }
        rastreioPorUsuario.remove(usuarioId);

        estacionarComoOffline(usuarioId);

        Long zonaAberta = eventoZonaAtualPorUsuario.remove(usuarioId);
        if (zonaAberta != null) {
            registroEventoPresencaService.registrarTransicaoDeZona(usuarioId, zonaAberta, null, Instant.now(clock));
        }
    }

    /**
     * Marca quem acabou de desconectar como {@code OFFLINE}, sem remover do estado - o avatar
     * continua visível pros demais (apagado) até a pessoa reconectar, quando {@link
     * #afterConnectionEstablished} sobrescreve essa entrada de novo com {@code DISPONIVEL}. Não
     * abre um novo {@code EventoPresenca}: é só uma troca de status, não uma visita de verdade a
     * lugar nenhum.
     *
     * <p>Pedido do usuário: "se a pessoa ficar 5 horas no mesmo lugar, permita isso, mas não
     * coloque ela para o lugar de descanso/fora do trabalho" - antes, desconectar (inclusive por
     * ficar muito tempo parado até o notebook dormir, ou a aba ser suspensa) teleportava o avatar
     * pro centro de "Fora do trabalho" ({@link #posicaoForaDoTrabalho}). Agora a posição não muda
     * nunca por causa disso - a pessoa fica {@code OFFLINE} exatamente onde estava, por quanto
     * tempo for, e só volta a se mexer se ela mesma andar de novo depois de reconectar.
     */
    private void estacionarComoOffline(Long usuarioId) {
        EstadoPresencaUsuario atual = estadoPorUsuario.get(usuarioId);
        if (atual == null) {
            return;
        }
        EstadoPresencaUsuario offline =
                new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), atual.x(), atual.y(), StatusAvatar.OFFLINE, atual.aparencia());
        estadoPorUsuario.put(usuarioId, offline);
        broadcast(new PresencaEventoWs("STATUS", List.of(offline)));
    }

    /** Centro da zona "Fora do trabalho" ({@link TipoZona#LIVRE}) - só usado hoje pra semear um
     * colega nunca visto nesta execução do servidor ({@link #semearColegasNoBoot}), que não tem
     * posição real nenhuma pra preservar. Sem essa zona seedada (não deveria acontecer em
     * produção), cai no {@code x}/{@code y} padrão informado por quem chama. */
    private PosicaoXY posicaoForaDoTrabalho(int xPadrao, int yPadrao) {
        Optional<Zona> zonaForaDoTrabalho = localizadorZona.zonaPorTipo(TipoZona.LIVRE);
        int x = zonaForaDoTrabalho.map(zona -> zona.getX() + zona.getLargura() / 2).orElse(xPadrao);
        int y = zonaForaDoTrabalho.map(zona -> zona.getY() + zona.getAltura() / 2).orElse(yPadrao);
        return new PosicaoXY(x, y);
    }

    private record PosicaoXY(int x, int y) {
    }

    /**
     * Pedido do usuário: "toda hora o personagem está voltando para o marco zero da tela... de vez
     * em quando some e aparece no canto superior" - a causa mais provável não é bug de posição em
     * si, é o WebSocket caindo sozinho: nem o Nginx (proxy `/ws/`, `proxy_read_timeout` no padrão
     * de 60s) nem a borda da Railway garantem conexão parada aberta pra sempre - sem tráfego real
     * fluindo por tempo demais, o proxy fecha a conexão por trás, o navegador dispara {@code
     * onclose} e o `usePresencaWebSocket.ts` reconecta sozinho (com backoff) - cada reconexão é
     * visível pros outros como "sumiu e reapareceu". Isso é comum com QUALQUER usuário parado (lendo
     * um painel, numa reunião) - {@code POSICAO} só sai quando a pessoa anda, então nada mantém a
     * conexão "viva" aos olhos do proxy nesse meio tempo. Um PING de protocolo WebSocket (frame de
     * controle RFC 6455, não uma mensagem JSON - o navegador responde PONG sozinho, sem nenhum
     * código novo no front-end) a cada 25s conta como tráfego real e mantém a conexão sempre abaixo
     * do limiar de qualquer timeout de inatividade de 60s+ no caminho. Efeito colateral bom: {@link
     * #afterConnectionEstablished} também parou de resetar a posição pra {@code (0,0)} numa
     * reconexão de verdade (reaproveita a última posição conhecida) - as duas correções juntas.
     */
    @Scheduled(fixedRate = 25_000)
    public void enviarPing() {
        for (WebSocketSession sessao : sessoesPorUsuario.values()) {
            if (!sessao.isOpen()) {
                continue;
            }
            try {
                sessao.sendMessage(new PingMessage());
            } catch (IOException | IllegalStateException e) {
                log.warn("Falha ao enviar ping de presença pra sessão {}", sessao.getId(), e);
            }
        }
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

        if ("POSICAO".equals(comando.tipo())) {
            tratarPosicao(session, comando);
        } else if ("STATUS".equals(comando.tipo())) {
            tratarStatus(session, comando);
        } else if ("RTC_SINAL".equals(comando.tipo())) {
            tratarSinalRtc(session, comando);
        }
    }

    /** Pedido do usuário: "voice, onde podemos falar dentro da sala... ou com a pessoa mais
     * próxima" - relay puro de sinalização WebRTC (SDP offer/answer + ICE candidates) entre dois
     * usuários conectados. O servidor nunca abre/interpreta {@code comando.sinal()} - é opaco pra
     * ele, só repassa pro destinatário certo, mesmo espírito de {@link #avisarConvite}/{@link
     * #avisarMensagem} (avisa um destinatário específico, silencioso se não estiver conectado),
     * mas disparado por uma mensagem recebida do próprio cliente, não por uma chamada de service.
     * Quem decide COM QUEM sinalizar é o cliente (par de voz calculado a partir de proximidade/
     * mesma sala, `mundo/proximidade.ts#calcularParesDeVoz`) - o servidor não valida isso aqui. */
    private void tratarSinalRtc(WebSocketSession session, ComandoWs comando) {
        if (comando.destinatarioId() == null || comando.sinal() == null) {
            return;
        }
        WebSocketSession destino = sessoesPorUsuario.get(comando.destinatarioId());
        if (destino == null) {
            return;
        }
        enviar(destino, new RtcSinalWs(usuarioId(session), comando.sinal()));
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
     * Entrar em QUALQUER zona troca o status (`STATUS_POR_ZONA`, ver javadoc da classe) - sair
     * restaura o status de antes de entrar, a menos que a pessoa tenha trocado de status na mão
     * enquanto estava dentro ({@link #rastreioPorUsuario} guarda esse "status pra restaurar", e
     * {@link #tratarStatus} o zera numa troca manual). Só ficar no espaço aberto (fora de toda
     * zona) não mexe em nada.
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
        return Optional.ofNullable(STATUS_POR_ZONA.get(tipoZona));
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

    /** Pedido do usuário: "chamar para reunião pela plataforma" - avisa em tempo real só quem foi
     * convidado (diferente de {@link #broadcast}), e só se estiver conectado agora; silencioso
     * (sem lançar, sem log) se não estiver - a reunião já foi criada de qualquer forma, o convite
     * por e-mail da própria Google e a aparição na agenda dela no app não dependem disso. Chamado
     * por {@code ReuniaoService#criar}, um por participante, depois que o link do Meet já existe. */
    public void avisarConvite(Long usuarioId, ConviteReuniaoWs convite) {
        WebSocketSession sessao = sessoesPorUsuario.get(usuarioId);
        if (sessao == null) {
            return;
        }
        enviar(sessao, convite);
    }

    /** Pedido do usuário: "chat... em tempo real, as mensagens devem enviar e receber no mesmo
     * momento que são enviadas. Não deve conter atraso" - mesmo mecanismo de {@link
     * #avisarConvite} (avisa só quem está conectado agora, silencioso se offline; quem estiver
     * offline vê a mensagem via {@code GET /chat/conversas/{id}/mensagens} na próxima vez que
     * abrir o chat). Chamado por {@code ChatService#enviar}, um por OUTRO participante da
     * conversa (nunca pro próprio autor - ele já recebe a mensagem na resposta HTTP do envio). */
    public void avisarMensagem(Long usuarioId, ChatMensagemWs mensagem) {
        WebSocketSession sessao = sessoesPorUsuario.get(usuarioId);
        if (sessao == null) {
            return;
        }
        enviar(sessao, mensagem);
    }

    /** Pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário" -
     * mesmo mecanismo de {@link #avisarConvite}/{@link #avisarMensagem}. Chamado por {@code
     * CardService#mover} pro responsável e/ou criador do card (exceto quem fez o próprio
     * movimento) quando o card entra na última coluna do projeto (heurística de "concluído" - o
     * board não tem uma coluna fixa com esse significado, colunas são nomeadas livremente). */
    public void avisarTarefaConcluida(Long usuarioId, TarefaConcluidaWs tarefa) {
        WebSocketSession sessao = sessoesPorUsuario.get(usuarioId);
        if (sessao == null) {
            return;
        }
        enviar(sessao, tarefa);
    }

    /** Pedido do usuário: "quando qualquer pessoa adicionar uma tarefa nova... deve informar
     * TODOS os usuários do sistema" - diferente de {@link #avisarConvite}/{@link
     * #avisarMensagem}/{@link #avisarTarefaConcluida} (avisam um destinatário específico por vez),
     * aqui é todo mundo conectado agora, exceto quem criou a tarefa (mesma convenção de nunca
     * notificar o autor da própria ação - ver {@link #avisarMensagem}). Quem estiver offline não
     * recebe este aviso em tempo real, mas ainda vê o item depois na central de notificações
     * persistente (pedido posterior do usuário: "ver as últimas que chegaram no sistema" - ver
     * {@code NotificacaoService#registrar}, chamado ao lado deste método em {@code CardService#criar}).
     * Chamado por {@code CardService#criar}. */
    public void avisarNovaTarefa(Long autorId, NovaTarefaWs tarefa) {
        TextMessage mensagem = new TextMessage(objectMapper.writeValueAsString(tarefa));
        for (Map.Entry<Long, WebSocketSession> entrada : sessoesPorUsuario.entrySet()) {
            if (entrada.getKey().equals(autorId)) {
                continue;
            }
            enviarMensagem(entrada.getValue(), mensagem);
        }
    }

    /** Pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita" -
     * o resultado da roleta é o "momento" compartilhado de todo mundo (diferente de
     * {@link #avisarNovaTarefa}, aqui inclui até quem girou - reprocessar o mesmo resultado que já
     * veio na resposta HTTP da própria ação é inofensivo). Chamado por
     * {@code HappyHourService#sortear}. */
    public void avisarSorteioHappyHour(SorteioHappyHourWs sorteio) {
        TextMessage mensagem = new TextMessage(objectMapper.writeValueAsString(sorteio));
        for (WebSocketSession sessao : sessoesPorUsuario.values()) {
            enviarMensagem(sessao, mensagem);
        }
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

    private void enviar(WebSocketSession sessao, Object evento) {
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

    /** Payload do convite em tempo real (ver {@link #avisarConvite}) - {@code tipo} fixo
     * {@code "CONVITE_REUNIAO"}, pro cliente distinguir de {@link PresencaEventoWs} (que sempre
     * carrega {@code usuarios}, nunca dados de uma reunião). Datas/horas como texto (não os tipos
     * Java) pelo mesmo motivo de sempre nesta camada: só serializa o que o frontend precisa exibir. */
    public record ConviteReuniaoWs(
            String tipo, Long reuniaoId, String titulo, String criadorNome, String data, String horaInicio, String horaFim,
            String linkMeet) {

        public ConviteReuniaoWs(Long reuniaoId, String titulo, String criadorNome, String data, String horaInicio, String horaFim,
                String linkMeet) {
            this("CONVITE_REUNIAO", reuniaoId, titulo, criadorNome, data, horaInicio, horaFim, linkMeet);
        }
    }

    /** Payload da mensagem em tempo real (ver {@link #avisarMensagem}) - {@code tipo} fixo
     * {@code "CHAT_MENSAGEM"}, mesmo espírito de {@link ConviteReuniaoWs}. */
    public record ChatMensagemWs(
            String tipo, Long conversaId, Long mensagemId, Long autorId, String autorNome, String texto, Instant criadoEm) {

        public ChatMensagemWs(Long conversaId, Long mensagemId, Long autorId, String autorNome, String texto, Instant criadoEm) {
            this("CHAT_MENSAGEM", conversaId, mensagemId, autorId, autorNome, texto, criadoEm);
        }
    }

    /** Payload de tarefa concluída (ver {@link #avisarTarefaConcluida}) - {@code tipo} fixo
     * {@code "TAREFA_CONCLUIDA"}, mesmo espírito de {@link ConviteReuniaoWs}/{@link ChatMensagemWs}. */
    public record TarefaConcluidaWs(String tipo, Long cardId, String cardTitulo, String projetoNome, String autorNome) {

        public TarefaConcluidaWs(Long cardId, String cardTitulo, String projetoNome, String autorNome) {
            this("TAREFA_CONCLUIDA", cardId, cardTitulo, projetoNome, autorNome);
        }
    }

    /** Payload de tarefa nova (ver {@link #avisarNovaTarefa}) - {@code tipo} fixo
     * {@code "NOVA_TAREFA"}, mesmo espírito de {@link TarefaConcluidaWs} (mesmo shape de campos,
     * significado diferente: "foi criada" em vez de "foi concluída"). */
    public record NovaTarefaWs(String tipo, Long cardId, String cardTitulo, String projetoNome, String autorNome) {

        public NovaTarefaWs(Long cardId, String cardTitulo, String projetoNome, String autorNome) {
            this("NOVA_TAREFA", cardId, cardTitulo, projetoNome, autorNome);
        }
    }

    /** Payload do resultado da roleta do Happy Hour (ver {@link #avisarSorteioHappyHour}) -
     * {@code tipo} fixo {@code "SORTEIO_HAPPY_HOUR"}, mesmo espírito de {@link NovaTarefaWs}. */
    public record SorteioHappyHourWs(String tipo, Long atividadeId, String descricao, String sorteadoPorNome) {

        public SorteioHappyHourWs(Long atividadeId, String descricao, String sorteadoPorNome) {
            this("SORTEIO_HAPPY_HOUR", atividadeId, descricao, sorteadoPorNome);
        }
    }

    /** {@code destinatarioId}/{@code sinal} só vêm preenchidos em {@code RTC_SINAL} (ver {@link
     * #tratarSinalRtc}) - nulos em POSICAO/STATUS. */
    private record ComandoWs(String tipo, Integer x, Integer y, String status, Long destinatarioId, Object sinal) {
    }

    /** Payload de sinalização WebRTC relayada (ver {@link #tratarSinalRtc}) - {@code tipo} fixo
     * {@code "RTC_SINAL"}, {@code sinal} opaco pro servidor (SDP offer/answer ou ICE candidate,
     * quem entende o formato são os dois clientes). */
    public record RtcSinalWs(String tipo, Long remetenteId, Object sinal) {

        public RtcSinalWs(Long remetenteId, Object sinal) {
            this("RTC_SINAL", remetenteId, sinal);
        }
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
