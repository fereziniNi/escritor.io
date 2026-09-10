package io.escritor.presenca.relatorio.domain;

public class EstatisticasDeOutroUsuarioException extends RuntimeException {

    public EstatisticasDeOutroUsuarioException() {
        super("Estas estatísticas pertencem a outro usuário");
    }
}
