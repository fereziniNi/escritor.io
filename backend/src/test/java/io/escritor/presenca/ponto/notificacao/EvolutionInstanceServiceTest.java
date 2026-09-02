package io.escritor.presenca.ponto.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??". Os
 * corpos de resposta usados aqui vêm de chamadas reais contra um Evolution API rodando de
 * verdade nesta sessão (não inventados) - inclusive a diferença de formato entre `/instance/
 * connect` (QR direto na raiz) e `/instance/create` (QR aninhado em `qrcode`).
 */
class EvolutionInstanceServiceTest {

    private static final String BASE_URL = "http://evolution.local";

    private record Ambiente(EvolutionInstanceService servico, MockRestServiceServer servidor) {
    }

    private static Ambiente montar(boolean habilitado) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
        var servico = new EvolutionInstanceService(builder, BASE_URL, "chave-123", "escritorio", habilitado);
        return new Ambiente(servico, servidor);
    }

    @Test
    void indisponivelQuandoDesabilitadoSemFazerNenhumaChamada() {
        var ambiente = montar(false);
        // Nenhum `.expect(...)` registrado - `verify()` só passa se nenhuma requisição foi feita.

        var estado = ambiente.servico().buscarEstado();

        assertThat(estado.situacao()).isEqualTo(EstadoWhatsApp.Situacao.INDISPONIVEL);
        ambiente.servidor().verify();
    }

    @Test
    void conectadoQuandoConnectionStateDevolveOpen() {
        var ambiente = montar(true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/instance/connectionState/escritorio"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"instance":{"instanceName":"escritorio","state":"open"}}
                        """, MediaType.APPLICATION_JSON));

        var estado = ambiente.servico().buscarEstado();

        assertThat(estado.situacao()).isEqualTo(EstadoWhatsApp.Situacao.CONECTADO);
        assertThat(estado.qrCodeBase64()).isNull();
        ambiente.servidor().verify();
    }

    @Test
    void aguardandoQrCodeQuandoInstanciaExisteMasNaoEstaConectada() {
        var ambiente = montar(true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/instance/connectionState/escritorio"))
                .andRespond(withSuccess("""
                        {"instance":{"instanceName":"escritorio","state":"connecting"}}
                        """, MediaType.APPLICATION_JSON));
        // Formato real: `/instance/connect` devolve o QR direto na raiz, não aninhado.
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/instance/connect/escritorio"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(
                        """
                        {"pairingCode":null,"code":"2@abc","base64":"data:image/png;base64,RECONECTAR","count":1}
                        """,
                        MediaType.APPLICATION_JSON));

        var estado = ambiente.servico().buscarEstado();

        assertThat(estado.situacao()).isEqualTo(EstadoWhatsApp.Situacao.AGUARDANDO_QRCODE);
        assertThat(estado.qrCodeBase64()).isEqualTo("data:image/png;base64,RECONECTAR");
        ambiente.servidor().verify();
    }

    @Test
    void criaAInstanciaEDevolveOQrCodeQuandoElaAindaNaoExiste() {
        var ambiente = montar(true);
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/instance/connectionState/escritorio"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"status":404,"error":"Not Found","response":{"message":["The \\"escritorio\\" instance does not exist"]}}
                                """));
        // Formato real: `/instance/create` devolve o QR aninhado em `qrcode`, diferente de `/instance/connect`.
        ambiente.servidor()
                .expect(requestTo(BASE_URL + "/instance/create"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        """
                        {"instance":{"instanceName":"escritorio","status":"connecting"},"hash":"abc",
                         "qrcode":{"pairingCode":null,"code":"2@xyz","base64":"data:image/png;base64,NOVAINSTANCIA","count":1}}
                        """,
                        MediaType.APPLICATION_JSON));

        var estado = ambiente.servico().buscarEstado();

        assertThat(estado.situacao()).isEqualTo(EstadoWhatsApp.Situacao.AGUARDANDO_QRCODE);
        assertThat(estado.qrCodeBase64()).isEqualTo("data:image/png;base64,NOVAINSTANCIA");
        ambiente.servidor().verify();
    }

    @Test
    void indisponivelQuandoOEvolutionApiFalha() {
        var ambiente = montar(true);
        ambiente.servidor().expect(requestTo(BASE_URL + "/instance/connectionState/escritorio")).andRespond(withServerError());

        var estado = ambiente.servico().buscarEstado();

        assertThat(estado.situacao()).isEqualTo(EstadoWhatsApp.Situacao.INDISPONIVEL);
        assertThat(estado.mensagem()).isNotBlank();
    }
}
