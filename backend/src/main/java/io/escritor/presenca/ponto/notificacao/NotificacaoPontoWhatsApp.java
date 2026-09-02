package io.escritor.presenca.ponto.notificacao;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Implementação via <a href="https://doc.evolution-api.com">Evolution API</a> (gateway
 * self-hosted de WhatsApp) - ver {@link NotificacaoPonto} pro porquê da interface separada.
 *
 * <p>{@code @Async}: quem bateu o ponto não deve esperar uma API externa responder pra ver a tela
 * atualizar - o registro já foi salvo antes de chegar aqui (ver {@code PontoService#marcar}), o
 * aviso ao chefe é só um efeito colateral de melhor esforço. Roda no executor dedicado {@code
 * notificacaoExecutor} (ver {@code AsyncConfig}), nunca no {@code SimpleAsyncExecutor} padrão.
 *
 * <p>Fica desligado por padrão ({@code app.evolution.habilitado=false}) - a integração exige
 * pareamento manual de um número real de WhatsApp via QR code (Evolution Manager, ver
 * DEVELOPMENT.md "Integração com WhatsApp") antes de fazer sentido ligar; sem isso, toda
 * tentativa de envio falharia de qualquer jeito. Erros de rede/API nunca sobem daqui - só ficam
 * registrados em log - pra nunca comprometer o registro de ponto (que já é a fonte de verdade e
 * já foi salvo) por causa de um provedor de mensageria fora do ar.
 */
@Component
public class NotificacaoPontoWhatsApp implements NotificacaoPonto {

    private static final Logger log = LoggerFactory.getLogger(NotificacaoPontoWhatsApp.class);
    private static final DateTimeFormatter FORMATO_HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId FUSO_BRASIL = ZoneId.of("America/Sao_Paulo");

    private final RestClient restClient;
    private final String apiKey;
    private final String instancia;
    private final String chefeNumero;
    private final boolean habilitado;

    public NotificacaoPontoWhatsApp(
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
    public void avisarPonto(Usuario usuario, TipoRegistroPonto tipo, Instant momento) {
        if (!habilitado || chefeNumero == null || chefeNumero.isBlank()) {
            return;
        }
        if (tipo != TipoRegistroPonto.ENTRADA && tipo != TipoRegistroPonto.SAIDA) {
            // Pedido do cliente foi "iniciar o trabalho ou terminar" - pausa/retorno de pausa não
            // é nem uma coisa nem outra, fica de fora de propósito.
            return;
        }

        String texto = montarTexto(usuario, tipo, momento);
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
            log.warn("Não foi possível avisar o chefe via WhatsApp (o ponto já foi registrado normalmente)", erro);
        }
    }

    private String montarTexto(Usuario usuario, TipoRegistroPonto tipo, Instant momento) {
        var horaLocal = momento.atZone(FUSO_BRASIL);
        String hora = FORMATO_HORA.format(horaLocal);
        String data = FORMATO_DATA.format(horaLocal);
        return tipo == TipoRegistroPonto.ENTRADA
                ? "🟢 " + usuario.getNome() + " iniciou o trabalho às " + hora + " (" + data + ")."
                : "🔴 " + usuario.getNome() + " encerrou o trabalho às " + hora + " (" + data + ").";
    }
}
