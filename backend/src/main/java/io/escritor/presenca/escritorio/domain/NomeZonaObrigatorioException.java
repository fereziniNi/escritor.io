package io.escritor.presenca.escritorio.domain;

public class NomeZonaObrigatorioException extends RuntimeException {

    public NomeZonaObrigatorioException() {
        super("Nome da zona é obrigatório");
    }
}
