package io.escritor.presenca.ponto.domain;

/** Mês pedido ainda não começou - não há marcação nem espelho de um mês futuro pra consultar. */
public class MesInvalidoException extends RuntimeException {

    public MesInvalidoException() {
        super("Mês no futuro");
    }
}
