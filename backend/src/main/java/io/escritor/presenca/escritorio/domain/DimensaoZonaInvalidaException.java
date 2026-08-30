package io.escritor.presenca.escritorio.domain;

public class DimensaoZonaInvalidaException extends RuntimeException {

    public DimensaoZonaInvalidaException() {
        super("Posição da zona não pode ser negativa e largura/altura devem ser maiores que zero");
    }
}
