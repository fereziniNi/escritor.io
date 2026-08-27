package io.escritor.presenca.ponto.domain;

public class JustificativaObrigatoriaException extends RuntimeException {

    public JustificativaObrigatoriaException() {
        super("A justificativa é obrigatória para solicitar um ajuste de ponto");
    }
}
