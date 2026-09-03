package io.escritor.presenca.ponto.notificacao;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * `MockRestServiceServer` intercepta a chamada HTTP de verdade que `RestClient` faria - nenhum
 * Evolution API real precisa estar no ar pra rodar este teste.
 */
class EnvioWhatsAppEvolutionTest {

    private static final String BASE_URL = "http://evolution.local";

    private record Ambiente(EnvioWhatsAppEvolution servico, MockRestServiceServer servidor) {
    }

    private static Ambiente montar(String chefeNumero, boolean habilitado) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
        var servico = new EnvioWhatsAppEvolution(builder, BASE_URL, "chave-123", "escritorio", chefeNumero, habilitado);
        return new Ambiente(servico, servidor);
    }

    @Test
    void enviaOTextoPraONumeroDoChefe() {
        var ambiente = montar("5511999999999", true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/message/sendText/escritorio"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("apikey", "chave-123"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"number\":\"5511999999999\"")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Oi, chefe")))
                .andRespond(withSuccess());

        ambiente.servico().enviarParaChefe("Oi, chefe");

        ambiente.servidor().verify();
    }

    @Test
    void naoEnviaNadaQuandoDesabilitado() {
        var ambiente = montar("5511999999999", false);

        ambiente.servico().enviarParaChefe("Oi, chefe");

        ambiente.servidor().verify();
    }

    @Test
    void naoEnviaNadaQuandoNumeroDoChefeEstaVazio() {
        var ambiente = montar("", true);

        ambiente.servico().enviarParaChefe("Oi, chefe");

        ambiente.servidor().verify();
    }

    @Test
    void naoPropagaExcecaoQuandoOEnvioFalha() {
        var ambiente = montar("5511999999999", true);
        ambiente.servidor().expect(requestTo(BASE_URL + "/message/sendText/escritorio")).andRespond(withServerError());

        assertThatCode(() -> ambiente.servico().enviarParaChefe("Oi, chefe")).doesNotThrowAnyException();
    }
}
