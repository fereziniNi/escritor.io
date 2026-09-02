package io.escritor.presenca.ponto.notificacao;

/**
 * Resultado de {@link EvolutionInstanceService#buscarEstado()} - três situações possíveis pro
 * admin ver na tela de integração: já conectado (nada a fazer), aguardando alguém escanear o QR
 * code (`base64` vem preenchido, pronto pra virar `<img src>`), ou indisponível (Evolution API
 * fora do ar, desligado, ou qualquer erro - `mensagem` explica o motivo).
 */
public record EstadoWhatsApp(Situacao situacao, String qrCodeBase64, String mensagem) {

    public enum Situacao {
        CONECTADO,
        AGUARDANDO_QRCODE,
        INDISPONIVEL
    }

    public static EstadoWhatsApp conectado() {
        return new EstadoWhatsApp(Situacao.CONECTADO, null, null);
    }

    public static EstadoWhatsApp aguardandoQrCode(String qrCodeBase64) {
        return new EstadoWhatsApp(Situacao.AGUARDANDO_QRCODE, qrCodeBase64, null);
    }

    public static EstadoWhatsApp indisponivel(String mensagem) {
        return new EstadoWhatsApp(Situacao.INDISPONIVEL, null, mensagem);
    }
}
