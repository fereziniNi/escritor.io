package io.escritor.presenca.ponto.notificacao;

/**
 * Porta genérica pra mandar texto pro WhatsApp do chefe (número configurado em {@code
 * app.evolution.chefe-numero}) - extraída de {@code NotificacaoPontoWhatsApp} quando um segundo
 * recurso (resumo diário, ver {@code relatorio.service.EnvioRelatorioDiarioScheduler}) também
 * precisou mandar mensagem pro mesmo destinatário. Cada chamador decide o texto; esta porta só
 * decide "envia ou não" (desligado/sem número configurado) e "como" (Evolution API).
 */
public interface EnvioWhatsApp {

    void enviarParaChefe(String texto);
}
