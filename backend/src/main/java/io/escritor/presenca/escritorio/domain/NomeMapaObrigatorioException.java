package io.escritor.presenca.escritorio.domain;

public class NomeMapaObrigatorioException extends RuntimeException {

    public NomeMapaObrigatorioException() {
        super("Nome do mapa é obrigatório");
    }
}
