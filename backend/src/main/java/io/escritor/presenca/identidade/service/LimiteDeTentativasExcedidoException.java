package io.escritor.presenca.identidade.service;

/** Auditoria de segurança (VULN-05, MEDIUM) - ver {@code LimitadorDeTaxa}. */
public class LimiteDeTentativasExcedidoException extends RuntimeException {

    public LimiteDeTentativasExcedidoException() {
        super("Muitas tentativas - aguarde um pouco antes de tentar de novo");
    }
}
