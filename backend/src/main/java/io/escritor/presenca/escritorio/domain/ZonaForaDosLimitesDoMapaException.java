package io.escritor.presenca.escritorio.domain;

public class ZonaForaDosLimitesDoMapaException extends RuntimeException {

    public ZonaForaDosLimitesDoMapaException() {
        super("Zona ultrapassa os limites do mapa");
    }
}
