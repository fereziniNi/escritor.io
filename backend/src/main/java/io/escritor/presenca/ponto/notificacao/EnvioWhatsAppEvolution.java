package io.escritor.presenca.ponto.notificacao;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Implementação de {@link EnvioWhatsApp} via Evolution API - ver a interface pro porquê de ficar
 * separada. {@code @Async}: nenhum chamador (marcar ponto, agendador do resumo diário) deve
 * travar esperando uma API externa responder; roda no executor dedicado {@code
 * notificacaoExecutor} (ver {@code AsyncConfig}).
 *
 * <p>Fica desligado por padrão ({@code app.evolution.habilitado=false}) ou sem número de chefe
 * configurado - mesmo guard que existia antes só dentro de {@code NotificacaoPontoWhatsApp},
 * agora compartilhado por qualquer coisa que precise avisar o chefe. Erros de rede/API nunca
 * sobem daqui - só ficam em log - cada chamador já tratava isso como best-effort antes desta
 * extração, e continua assim.
 */
@Component
public class EnvioWhatsAppEvolution implements EnvioWhatsApp {

    private static final Logger log = LoggerFactory.getLogger(EnvioWhatsAppEvolution.class);

    private final RestClient restClient;
    private final String apiKey;
    private final String instancia;
    private final String chefeNumero;
    private final boolean habilitado;

    public EnvioWhatsAppEvolution(
            RestClient.Builder restClientBuilder,
            @Value("${app.evolution.base-url}") String baseUrl,
            @Value("${app.evolution.api-key}") String apiKey,
            @Value("${app.evolution.instancia}") String instancia,
            @Value("${app.evolution.chefe-numero}") String chefeNumero,
            @Value("${app.evolution.habilitado}") boolean habilitado) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.instancia = instancia;
        this.chefeNumero = chefeNumero;
        this.habilitado = habilitado;
    }

    @Override
    @Async("notificacaoExecutor")
    public void enviarParaChefe(String texto) {
        if (!habilitado || chefeNumero == null || chefeNumero.isBlank()) {
            return;
        }

        try {
            restClient
                    .post()
                    .uri("/message/sendText/{instancia}", instancia)
                    .header("apikey", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("number", chefeNumero, "text", texto))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException erro) {
            log.warn("Não foi possível mandar mensagem pro chefe via WhatsApp", erro);
        }
    }
}
