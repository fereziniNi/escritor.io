package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.notificacao.EstadoWhatsApp;

public record EstadoWhatsAppResponse(EstadoWhatsApp.Situacao situacao, String qrCodeBase64, String mensagem) {

    public static EstadoWhatsAppResponse de(EstadoWhatsApp estado) {
        return new EstadoWhatsAppResponse(estado.situacao(), estado.qrCodeBase64(), estado.mensagem());
    }
}
