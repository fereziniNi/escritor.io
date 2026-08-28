package io.escritor.presenca.apontamento.domain;

public class ApontamentoJaEncerradoException extends RuntimeException {

    public ApontamentoJaEncerradoException() {
        super("Este apontamento já foi encerrado");
    }
}
