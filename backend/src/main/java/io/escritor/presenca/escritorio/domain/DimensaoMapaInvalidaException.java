package io.escritor.presenca.escritorio.domain;

public class DimensaoMapaInvalidaException extends RuntimeException {

    public DimensaoMapaInvalidaException() {
        super("Largura e altura do mapa devem ser maiores que zero");
    }
}
