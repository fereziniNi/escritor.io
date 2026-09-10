package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.service.LocalizadorZona;
import io.escritor.presenca.escritorio.service.RegistroEventoPresencaService;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    private PresencaWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new PresencaWebSocketHandler(objectMapper, validadorPosicaoMapa, localizadorZona, registroEventoPresencaService, RELOGIO_FIXO);
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

    @Test
    void todoTipoDeZonaMapeiaParaUmStatusAutomatico() {
        // pedido do usuário: "independente de qual sala seja, atualize o status" - guarda contra
        // alguém adicionar um TipoZona novo e esquecer de mapear (o status ficaria mudo naquela sala)
        assertThat(PresencaWebSocketHandler.STATUS_POR_ZONA).containsOnlyKeys(TipoZona.values());
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
