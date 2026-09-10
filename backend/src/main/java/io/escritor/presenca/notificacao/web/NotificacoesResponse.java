package io.escritor.presenca.notificacao.web;

import java.util.List;

public record NotificacoesResponse(List<NotificacaoResponse> itens, long naoLidas) {
}
