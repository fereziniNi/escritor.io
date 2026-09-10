package io.escritor.presenca.chat.domain;

/** Ex.: tentar abrir uma conversa direta consigo mesmo. */
public class ConversaInvalidaException extends RuntimeException {

    public ConversaInvalidaException(String mensagem) {
        super(mensagem);
    }
}
