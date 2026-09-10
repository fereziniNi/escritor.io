package io.escritor.presenca.chat.web;

import io.escritor.presenca.chat.domain.TipoConversa;

/** Montado em {@code ChatService} (não um {@code .de()} estático simples como em outros épicos) -
 * {@code nome} e {@code naoLidas} dependem de outras entidades além da própria {@link
 * io.escritor.presenca.chat.domain.Conversa} (o outro participante, numa DIRETA; a contagem de
 * mensagens depois da última leitura). */
public record ConversaResponse(Long id, TipoConversa tipo, String nome, MensagemResponse ultimaMensagem, long naoLidas) {
}
