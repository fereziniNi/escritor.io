package io.escritor.presenca.apontamento.domain;

public class FimAntesDoInicioException extends RuntimeException {

    public FimAntesDoInicioException() {
        super("O fim do apontamento não pode ser antes do início");
    }
}
