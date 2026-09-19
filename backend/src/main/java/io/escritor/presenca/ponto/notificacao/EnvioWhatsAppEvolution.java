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
 * separada. {@code @Async}: nenhum chamador (marcar ponto, agendador do resumo diário, tarefa
 * concluída, mensagem de chat) deve travar esperando uma API externa responder; roda no executor
 * dedicado {@code notificacaoExecutor} (ver {@code AsyncConfig}).
 *
 * <p>Fica desligado por padrão ({@code app.evolution.habilitado=false}), e cada método tem seu
 * próprio guard de "tem número?" ({@code enviarParaChefe}: {@code app.evolution.chefe-numero};
 * {@code enviar}: o número passado por quem chama, ex. {@code Usuario#getWhatsapp}). Erros de
 * rede/API nunca sobem daqui - só ficam em log - cada chamador já tratava isso como best-effort
 * antes desta extração, e continua assim.
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
        enviarSe(habilitado && chefeNumero != null && !chefeNumero.isBlank(), chefeNumero, texto);
    }

    @Override
    @Async("notificacaoExecutor")
    public void enviar(String numero, String texto) {
        enviarSe(habilitado && numero != null && !numero.isBlank(), numero, texto);
    }

    private void enviarSe(boolean deveEnviar, String numero, String texto) {
        if (!deveEnviar) {
            return;
        }
        try {
            restClient
                    .post()
                    .uri("/message/sendText/{instancia}", instancia)
                    .header("apikey", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("number", numero, "text", texto))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RuntimeException erro) {
            // não loga o número em si (dado pessoal do colaborador, diferente do chefe fixo) - só
            // que uma tentativa de envio falhou.
            log.warn("Não foi possível mandar uma mensagem via WhatsApp", erro);
        }
    }
}
