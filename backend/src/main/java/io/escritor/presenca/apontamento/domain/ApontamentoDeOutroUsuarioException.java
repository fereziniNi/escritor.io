package io.escritor.presenca.apontamento.domain;

public class ApontamentoDeOutroUsuarioException extends RuntimeException {

    public ApontamentoDeOutroUsuarioException() {
        super("Este apontamento pertence a outro usuário");
    }
}
