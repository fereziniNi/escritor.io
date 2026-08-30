package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.service.LocalizadorZona;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.UnaryOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PRD §5/§3.5: handler puro (sem STOMP), mesmo espírito de {@code QuadroWebSocketHandler}
 * (kanban, S3.11), mas global - não há "sala"/id de recurso aqui, só um canal único de presença
 * pra todo mundo autenticado. Estado vivo (posição, status) fica só neste mapa em memória, nunca
 * no banco (PRD). Conectar registra o usuário com posição inicial (0,0) e status
 * {@code DISPONIVEL}, e devolve pra ele mesmo um snapshot de todo mundo presente (incluindo
 * ele); desconectar remove o usuário do estado. Mensagem recebida do cliente agora tem um
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
 */
@Component
public class PresencaWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresencaWebSocketHandler.class);

    private final Map<Long, WebSocketSession> sessoesPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, EstadoPresencaUsuario> estadoPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, RastreioZona> rastreioPorUsuario = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final ValidadorPosicaoMapa validadorPosicaoMapa;
    private final LocalizadorZona localizadorZona;

    public PresencaWebSocketHandler(ObjectMapper objectMapper, ValidadorPosicaoMapa validadorPosicaoMapa, LocalizadorZona localizadorZona) {
        this.objectMapper = objectMapper;
        this.validadorPosicaoMapa = validadorPosicaoMapa;
        this.localizadorZona = localizadorZona;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long usuarioId = usuarioId(session);
        String nome = (String) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_NOME);

        estadoPorUsuario.put(usuarioId, new EstadoPresencaUsuario(usuarioId, nome, 0, 0, StatusAvatar.DISPONIVEL));
        sessoesPorUsuario.put(usuarioId, session);

        enviar(session, new PresencaEventoWs("SNAPSHOT", List.copyOf(estadoPorUsuario.values())));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long usuarioId = usuarioId(session);
        estadoPorUsuario.remove(usuarioId);
        sessoesPorUsuario.remove(usuarioId);
        rastreioPorUsuario.remove(usuarioId);
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

        if ("POSICAO".equals(comando.tipo())) {
            tratarPosicao(session, comando);
        } else if ("STATUS".equals(comando.tipo())) {
            tratarStatus(session, comando);
        }
    }

    private void tratarPosicao(WebSocketSession session, ComandoWs comando) {
        if (comando.x() == null || comando.y() == null || !validadorPosicaoMapa.dentroDosLimites(comando.x(), comando.y())) {
            return;
        }

        Long usuarioId = usuarioId(session);
        atualizarEstado(session, atual -> {
            StatusAvatar novoStatus = resolverStatusAposMover(usuarioId, atual.status(), comando.x(), comando.y());
            return new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), comando.x(), comando.y(), novoStatus);
        }).ifPresent(atualizado -> broadcast(new PresencaEventoWs("POSICAO", List.of(atualizado))));
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
        atualizarEstado(session, atual -> new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), atual.x(), atual.y(), novoStatus))
                .ifPresent(atualizado -> {
                    // troca manual dentro de uma zona rastreada invalida o "restaurar ao sair" (S6.7) -
                    // a escolha agora é do usuário, não mais um efeito automático da zona
                    rastreioPorUsuario.computeIfPresent(usuarioId, (id, rastreio) -> new RastreioZona(rastreio.zonaId(), null));
                    broadcast(new PresencaEventoWs("STATUS", List.of(atualizado)));
                });
    }

    private Optional<EstadoPresencaUsuario> atualizarEstado(WebSocketSession session, UnaryOperator<EstadoPresencaUsuario> atualizar) {
        Long usuarioId = usuarioId(session);
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

    private void enviarMensagem(WebSocketSession sessao, TextMessage mensagem) {
        if (!sessao.isOpen()) {
            return;
        }
        try {
            sessao.sendMessage(mensagem);
        } catch (IOException e) {
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
