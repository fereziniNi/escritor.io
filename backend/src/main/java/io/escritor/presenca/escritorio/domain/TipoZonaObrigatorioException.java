package io.escritor.presenca.escritorio.domain;

public class TipoZonaObrigatorioException extends RuntimeException {

    public TipoZonaObrigatorioException() {
        super("Tipo da zona é obrigatório");
    }
}
