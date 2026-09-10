package io.escritor.presenca.chat.domain;

/** Ler ou postar numa conversa direta da qual não se participa. */
public class AcessoNegadoAConversaException extends RuntimeException {

    public AcessoNegadoAConversaException(String mensagem) {
        super(mensagem);
    }
}
