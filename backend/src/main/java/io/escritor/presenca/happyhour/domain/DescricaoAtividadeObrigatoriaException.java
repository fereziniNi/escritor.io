package io.escritor.presenca.happyhour.domain;

public class DescricaoAtividadeObrigatoriaException extends RuntimeException {

    public DescricaoAtividadeObrigatoriaException() {
        super("A descrição da atividade é obrigatória");
    }
}
