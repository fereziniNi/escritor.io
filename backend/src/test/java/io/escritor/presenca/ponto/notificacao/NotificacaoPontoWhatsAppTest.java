package io.escritor.presenca.ponto.notificacao;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Pedido do cliente: "integração com o evolution api para... enviar uma mensagem para o chefe
 * avisando". `MockRestServiceServer` intercepta a chamada HTTP de verdade que `RestClient` faria -
 * nenhum Evolution API real precisa estar no ar pra rodar este teste.
 */
class NotificacaoPontoWhatsAppTest {

    private static final String BASE_URL = "http://evolution.local";
    // Construído a partir do horário de São Paulo de propósito (não `Instant.parse` com um offset
    // literal) - o texto da mensagem é montado no fuso America/Sao_Paulo (ver
    // `NotificacaoPontoWhatsApp`), e o teste quer um "12:00" sem ambiguidade sobre qual fuso gerou
    // esse número.
    private static final Instant MOMENTO =
            ZonedDateTime.of(2026, 1, 15, 12, 0, 0, 0, ZoneId.of("America/Sao_Paulo")).toInstant();

    private static Usuario usuario(String nome) {
        return new Usuario(nome, nome.toLowerCase() + "@escritor.io", Papel.COLABORADOR, 480);
    }

    private record Ambiente(NotificacaoPontoWhatsApp servico, MockRestServiceServer servidor) {
    }

    private static Ambiente montar(String chefeNumero, boolean habilitado) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
        var servico = new NotificacaoPontoWhatsApp(builder, BASE_URL, "chave-123", "escritorio", chefeNumero, habilitado);
        return new Ambiente(servico, servidor);
    }

    @Test
    void avisaOChefeQuandoAlguemBateEntrada() {
        var ambiente = montar("5511999999999", true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/message/sendText/escritorio"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", "chave-123"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"number\":\"5511999999999\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("iniciou o trabalho às 12:00")))
                .andRespond(withSuccess());

        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.ENTRADA, MOMENTO);

        ambiente.servidor().verify();
    }

    @Test
    void avisaOChefeQuandoAlguemBateSaida() {
        var ambiente = montar("5511999999999", true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/message/sendText/escritorio"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("encerrou o trabalho às 12:00")))
                .andRespond(withSuccess());

        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.SAIDA, MOMENTO);

        ambiente.servidor().verify();
    }

    @Test
    void naoEnviaNadaQuandoDesabilitado() {
        var ambiente = montar("5511999999999", false);
        // Nenhum `.expect(...)` registrado - `verify()` só passa se NENHUMA requisição foi feita.

        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.ENTRADA, MOMENTO);

        ambiente.servidor().verify();
    }

    @Test
    void naoEnviaNadaQuandoNumeroDoChefeEstaVazio() {
        var ambiente = montar("", true);

        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.ENTRADA, MOMENTO);

        ambiente.servidor().verify();
    }

    @Test
    void naoEnviaNadaParaPausaOuRetornoDePausa() {
        // Pedido do cliente foi "iniciar o trabalho ou terminar" - pausa não é nem uma coisa nem
        // outra.
        var ambiente = montar("5511999999999", true);

        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.PAUSA_INICIO, MOMENTO);
        ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.PAUSA_FIM, MOMENTO);

        ambiente.servidor().verify();
    }

    @Test
    void naoPropagaExcecaoQuandoOEnvioFalha() {
        // Best-effort de propósito: o registro de ponto já foi salvo antes de chegar aqui - o
        // chefe não receber o aviso nunca pode virar um erro pra quem bateu o ponto.
        var ambiente = montar("5511999999999", true);
        ambiente.servidor().expect(requestTo(BASE_URL + "/message/sendText/escritorio")).andRespond(withServerError());

        assertThatCode(() -> ambiente.servico().avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.ENTRADA, MOMENTO))
                .doesNotThrowAnyException();
    }
}
