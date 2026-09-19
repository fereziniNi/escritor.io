package io.escritor.presenca.ponto.notificacao;

/**
 * Porta genérica pra mandar texto pro WhatsApp - extraída de {@code NotificacaoPontoWhatsApp}
 * quando um segundo recurso (resumo diário, ver {@code relatorio.service.EnvioRelatorioDiarioScheduler})
 * também precisou mandar mensagem pro mesmo destinatário. Cada chamador decide o texto; esta porta
 * só decide "envia ou não" (desligado/sem número) e "como" (Evolution API).
 *
 * <p>{@link #enviarParaChefe} manda pro número fixo da empresa ({@code
 * app.evolution.chefe-numero}, avisos de ponto/resumo diário); {@link #enviar} manda pra um número
 * arbitrário - pedido do usuário: avisar por WhatsApp quando uma tarefa é concluída ou uma
 * mensagem de chat chega, pro WhatsApp de CADA colaborador ({@code Usuario#getWhatsapp}), não pro
 * chefe.
 */
public interface EnvioWhatsApp {

    void enviarParaChefe(String texto);

    void enviar(String numero, String texto);
}
