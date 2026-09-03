package io.escritor.presenca.ponto.notificacao;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

/**
 * Implementação via <a href="https://doc.evolution-api.com">Evolution API</a> (gateway
 * self-hosted de WhatsApp) - ver {@link NotificacaoPonto} pro porquê da interface separada. Só
 * decide "qual texto" e "quando" (entrada/saída, não pausa) - o "envia ou não"/"como" já é
 * responsabilidade de {@link EnvioWhatsApp} (compartilhado com o resumo diário, ver {@code
 * relatorio.service.EnvioRelatorioDiarioScheduler}), incluindo o `@Async` que evita travar quem
 * bateu o ponto esperando uma API externa responder.
 */
@Component
public class NotificacaoPontoWhatsApp implements NotificacaoPonto {

    private static final DateTimeFormatter FORMATO_HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId FUSO_BRASIL = ZoneId.of("America/Sao_Paulo");

    private final EnvioWhatsApp envioWhatsApp;

    public NotificacaoPontoWhatsApp(EnvioWhatsApp envioWhatsApp) {
        this.envioWhatsApp = envioWhatsApp;
    }

    @Override
    public void avisarPonto(Usuario usuario, TipoRegistroPonto tipo, Instant momento) {
        if (tipo != TipoRegistroPonto.ENTRADA && tipo != TipoRegistroPonto.SAIDA) {
            // Pedido do cliente foi "iniciar o trabalho ou terminar" - pausa/retorno de pausa não
            // é nem uma coisa nem outra, fica de fora de propósito.
            return;
        }

        envioWhatsApp.enviarParaChefe(montarTexto(usuario, tipo, momento));
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
