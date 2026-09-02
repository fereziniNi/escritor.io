package io.escritor.presenca.ponto.notificacao;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??" - antes
 * o pareamento exigia rodar `curl` na mão (ver DEVELOPMENT.md); agora o admin abre uma tela dentro
 * do próprio Escritório e vê o QR code ali, sem sair da aplicação (ver {@code
 * WhatsAppIntegracaoController}).
 *
 * <p>Só consulta/gerencia a instância do Evolution API (criar, checar conexão, pegar QR code) -
 * quem manda mensagem de verdade é {@link NotificacaoPontoWhatsApp}. As duas classes conversam
 * com o mesmo Evolution API mas por responsabilidades diferentes, cada uma com seu próprio
 * `RestClient` (mesmo padrão simples de não compartilhar estado entre os dois - ver comentário
 * em `NotificacaoPontoWhatsApp` sobre não ter um bean central).
 */
@Service
public class EvolutionInstanceService {

    private static final Logger log = LoggerFactory.getLogger(EvolutionInstanceService.class);

    private final RestClient restClient;
    private final String apiKey;
    private final String instancia;
    private final boolean habilitado;

    public EvolutionInstanceService(
            RestClient.Builder restClientBuilder,
            @Value("${app.evolution.base-url}") String baseUrl,
            @Value("${app.evolution.api-key}") String apiKey,
            @Value("${app.evolution.instancia}") String instancia,
            @Value("${app.evolution.habilitado}") boolean habilitado) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.instancia = instancia;
        this.habilitado = habilitado;
    }

    // Formatos reais confirmados contra um Evolution API rodando de verdade nesta sessão - as
    // duas chamadas de QR code (criar instância vs. reconectar uma que já existe) devolvem o
    // campo `qrcode`/`base64` em formatos DIFERENTES (uma aninhada, a outra não), por isso dois
    // records distintos em vez de um só reaproveitado.
    private record RespostaConexao(EstadoInstancia instance) {
    }

    private record EstadoInstancia(String state) {
    }

    private record QrCode(String base64) {
    }

    private record RespostaCriarInstancia(QrCode qrcode) {
    }

    public EstadoWhatsApp buscarEstado() {
        if (!habilitado) {
            return EstadoWhatsApp.indisponivel(
                    "Integração desligada (app.evolution.habilitado=false) - configure EVOLUTION_HABILITADO=true.");
        }

        try {
            RespostaConexao conexao = restClient
                    .get()
                    .uri("/instance/connectionState/{instancia}", instancia)
                    .header("apikey", apiKey)
                    .retrieve()
                    .body(RespostaConexao.class);

            if (conexao != null && conexao.instance() != null && "open".equals(conexao.instance().state())) {
                return EstadoWhatsApp.conectado();
            }

            // Instância existe mas não está conectada - pega um QR code fresco pra reconectar.
            QrCode qr = restClient
                    .get()
                    .uri("/instance/connect/{instancia}", instancia)
                    .header("apikey", apiKey)
                    .retrieve()
                    .body(QrCode.class);
            return EstadoWhatsApp.aguardandoQrCode(qr == null ? null : qr.base64());
        } catch (HttpClientErrorException.NotFound naoEncontrada) {
            return criarInstanciaEBuscarQrCode();
        } catch (RuntimeException erro) {
            log.warn("Não foi possível falar com o Evolution API", erro);
            return EstadoWhatsApp.indisponivel("Não foi possível falar com o Evolution API - ver logs do backend.");
        }
    }

    private EstadoWhatsApp criarInstanciaEBuscarQrCode() {
        try {
            RespostaCriarInstancia criada = restClient
                    .post()
                    .uri("/instance/create")
                    .header("apikey", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("instanceName", instancia, "integration", "WHATSAPP-BAILEYS", "qrcode", true))
                    .retrieve()
                    .body(RespostaCriarInstancia.class);
            String base64 = criada == null || criada.qrcode() == null ? null : criada.qrcode().base64();
            return EstadoWhatsApp.aguardandoQrCode(base64);
        } catch (RuntimeException erro) {
            log.warn("Não foi possível criar a instância no Evolution API", erro);
            return EstadoWhatsApp.indisponivel("Não foi possível criar a instância no Evolution API - ver logs do backend.");
        }
    }
}
