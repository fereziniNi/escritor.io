package io.escritor.presenca.apontamento.domain;

public class LancamentoManualInvalidoException extends RuntimeException {

    public LancamentoManualInvalidoException(String mensagem) {
        super(mensagem);
    }
}
