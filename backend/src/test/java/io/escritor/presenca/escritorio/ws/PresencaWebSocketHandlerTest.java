package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.service.LocalizadorZona;
import io.escritor.presenca.escritorio.service.RegistroEventoPresencaService;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pedido do usuário: "voice, onde podemos falar dentro da sala... ou com a pessoa mais próxima" -
 * primeiro teste unitário desta classe (até aqui só existia o {@code PresencaWebSocketIT}, já
 * conhecido como flaky) - cobre só o relay de sinalização WebRTC, sem precisar de um
 * {@code RTCPeerConnection} de verdade (isso é feito no frontend, `useVozProximidade.ts`; o
 * servidor nunca abre {@code sinal}, só repassa).
 */
@ExtendWith(MockitoExtension.class)
class PresencaWebSocketHandlerTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-13T12:00:00Z"), ZoneOffset.UTC);

    @Mock
    private ValidadorPosicaoMapa validadorPosicaoMapa;

    @Mock
    private LocalizadorZona localizadorZona;

    @Mock
    private RegistroEventoPresencaService registroEventoPresencaService;

    @Mock
    private UsuarioRepository usuarioRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private PresencaWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new PresencaWebSocketHandler(
                objectMapper, validadorPosicaoMapa, localizadorZona, registroEventoPresencaService, usuarioRepository, RELOGIO_FIXO);
    }

    private WebSocketSession sessaoFalsa(Long usuarioId, String nome) {
        WebSocketSession sessao = mock(WebSocketSession.class);
        Map<String, Object> atributos = new HashMap<>();
        atributos.put("usuarioId", usuarioId);
        atributos.put("nome", nome);
        atributos.put("aparencia", AparenciaAvatar.padrao());
        when(sessao.getAttributes()).thenReturn(atributos);
        lenient().when(sessao.isOpen()).thenReturn(true);
        return sessao;
    }

    @Test
    void relayaSinalRtcPraSessaoDoDestinatarioConectado() throws Exception {
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        WebSocketSession sessaoBeto = sessaoFalsa(2L, "Beto");
        handler.afterConnectionEstablished(sessaoAna);
        handler.afterConnectionEstablished(sessaoBeto);
        // limpa o SNAPSHOT inicial de cada um (afterConnectionEstablished já manda sendMessage) -
        // só nos interessa o que acontece a partir daqui.
        clearInvocations(sessaoAna, sessaoBeto);

        handler.handleTextMessage(
                sessaoAna,
                new TextMessage("""
                        {"tipo":"RTC_SINAL","destinatarioId":2,"sinal":{"type":"offer","sdp":"v=0..."}}
                        """));

        var captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(sessaoBeto).sendMessage(captor.capture());
        String enviado = captor.getValue().getPayload();
        assertThat(enviado).contains("\"tipo\":\"RTC_SINAL\"").contains("\"remetenteId\":1").contains("\"type\":\"offer\"");
        verify(sessaoAna, never()).sendMessage(any());
    }

    @Test
    void naoFazNadaQuandoDestinatarioNaoEstaConectado() throws Exception {
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoAna);
        clearInvocations(sessaoAna);

        handler.handleTextMessage(
                sessaoAna,
                new TextMessage("""
                        {"tipo":"RTC_SINAL","destinatarioId":999,"sinal":{"type":"offer"}}
                        """));

        verify(sessaoAna, never()).sendMessage(any());
    }

    /** Pedido do usuário: "não estou vendo meus colegas, mesmo offline nenhum deles está
     * aparecendo... a movimentação e presença deve ser TUDO AO VIVO" - antes desta correção, um
     * colega que nunca tinha conectado em `/ws/presenca` nesta execução do servidor simplesmente
     * não existia no snapshot de ninguém, nem como OFFLINE. `semearColegasNoBoot` roda de verdade
     * no boot via {@code ApplicationReadyEvent} (ver {@code PresencaWebSocketHandler}) - aqui é
     * chamado direto, simulando esse boot sem precisar de contexto Spring. */
    @Test
    void snapshotDeQuemConectaJaTrazColegaQueAindaNaoConectouComoOffline() throws Exception {
        Usuario beto = new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(beto, "id", 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(beto));
        handler.semearColegasNoBoot();

        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoAna);

        var captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(sessaoAna).sendMessage(captor.capture());
        String enviado = captor.getValue().getPayload();
        assertThat(enviado)
                .contains("\"tipo\":\"SNAPSHOT\"")
                .contains("\"usuarioId\":1") // Ana, quem conectou agora
                .contains("\"usuarioId\":2") // Beto, nunca conectou, ainda assim aparece
                .contains("\"nome\":\"Beto Lima\"")
                .contains("\"status\":\"OFFLINE\"");
    }

    /** Pedido do usuário: "toda hora o personagem está voltando para o marco zero da tela... ele
     * deve estar sempre na posição que está" - antes, toda conexão (não só a primeira) jogava a
     * posição de volta pra (0,0), então uma reconexão depois de uma queda (rede, proxy derrubando
     * conexão parada) fazia o avatar "teleportar" de volta pro canto do mapa. */
    @Test
    void reconectarDepoisDeCairPreservaAUltimaPosicaoConhecida() throws Exception {
        when(validadorPosicaoMapa.dentroDosLimites(10, 20)).thenReturn(true);
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoAna);
        handler.handleTextMessage(sessaoAna, new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":20}"));

        // simula a queda de verdade (onclose do navegador) e a reconexão automática em seguida
        handler.afterConnectionClosed(sessaoAna, CloseStatus.NORMAL);
        WebSocketSession sessaoAnaReconectada = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoAnaReconectada);

        var captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(sessaoAnaReconectada).sendMessage(captor.capture());
        assertThat(captor.getValue().getPayload()).contains("\"x\":10").contains("\"y\":20");
    }

    /** Pedido do usuário: "na plataforma parece que está offline mas está trabalhando" - o close da
     * sessão ANTIGA chegando depois da reconexão não pode marcar OFFLINE quem já tem sessão nova. */
    @Test
    void fechamentoTardioDaSessaoAntigaNaoMarcaOfflineQuemJaReconectou() throws Exception {
        WebSocketSession sessaoAntiga = sessaoFalsa(1L, "Ana");
        WebSocketSession sessaoBeto = sessaoFalsa(2L, "Beto");
        handler.afterConnectionEstablished(sessaoAntiga);
        handler.afterConnectionEstablished(sessaoBeto);
        WebSocketSession sessaoNova = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoNova);
        clearInvocations(sessaoBeto);

        handler.afterConnectionClosed(sessaoAntiga, CloseStatus.GOING_AWAY);

        verify(sessaoBeto, never()).sendMessage(any());
    }

    /** Pedido do usuário: mesmo problema acima - a causa mais provável de reconexões desnecessárias
     * é o proxy/plataforma fechando a conexão por ela ficar "quieta" tempo demais sem tráfego (ver
     * javadoc de {@code enviarPing}). Um PING de protocolo periódico conta como tráfego real. */
    @Test
    void enviarPingMandaPingDeProtocoloPraTodaSessaoAberta() throws Exception {
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        WebSocketSession sessaoBeto = sessaoFalsa(2L, "Beto");
        handler.afterConnectionEstablished(sessaoAna);
        handler.afterConnectionEstablished(sessaoBeto);
        clearInvocations(sessaoAna, sessaoBeto);

        handler.enviarPing();

        verify(sessaoAna).sendMessage(any(PingMessage.class));
        verify(sessaoBeto).sendMessage(any(PingMessage.class));
    }

    @Test
    void enviarPingIgnoraSessaoJaFechada() throws Exception {
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        handler.afterConnectionEstablished(sessaoAna);
        clearInvocations(sessaoAna);
        when(sessaoAna.isOpen()).thenReturn(false);

        handler.enviarPing();

        verify(sessaoAna, never()).sendMessage(any());
    }

    @Test
    void todoTipoDeZonaMapeiaParaUmStatusAutomaticoMenosForaDoTrabalho() {
        // pedido do usuário: "independente de qual sala seja, atualize o status" - guarda contra
        // alguém adicionar um TipoZona novo e esquecer de mapear (o status ficaria mudo naquela
        // sala). LIVRE ("Fora do trabalho") é a única exceção de propósito - pedido do usuário:
        // "ele nunca deve redirecionar para ausente a menos que ele escolha essa opção" (ver
        // PresencaWebSocketHandler#STATUS_POR_ZONA).
        List<TipoZona> tiposComStatusAutomatico =
                Arrays.stream(TipoZona.values()).filter(tipo -> tipo != TipoZona.LIVRE).toList();
        assertThat(PresencaWebSocketHandler.STATUS_POR_ZONA).containsOnlyKeys(tiposComStatusAutomatico.toArray(new TipoZona[0]));
        assertThat(PresencaWebSocketHandler.STATUS_POR_ZONA).doesNotContainKey(TipoZona.LIVRE);
    }

    @Test
    void ignoraSinalSemDestinatarioOuSemConteudo() throws Exception {
        WebSocketSession sessaoAna = sessaoFalsa(1L, "Ana");
        WebSocketSession sessaoBeto = sessaoFalsa(2L, "Beto");
        handler.afterConnectionEstablished(sessaoAna);
        handler.afterConnectionEstablished(sessaoBeto);
        clearInvocations(sessaoAna, sessaoBeto);

        handler.handleTextMessage(
                sessaoAna,
                new TextMessage("""
                        {"tipo":"RTC_SINAL","sinal":{"type":"offer"}}
                        """));
        handler.handleTextMessage(
                sessaoAna,
                new TextMessage("""
                        {"tipo":"RTC_SINAL","destinatarioId":2}
                        """));

        verify(sessaoBeto, never()).sendMessage(any());
    }
}
