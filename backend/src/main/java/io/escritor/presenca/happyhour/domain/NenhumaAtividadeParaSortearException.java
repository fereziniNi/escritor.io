package io.escritor.presenca.happyhour.domain;

public class NenhumaAtividadeParaSortearException extends RuntimeException {

    public NenhumaAtividadeParaSortearException() {
        super("Não há nenhuma atividade sugerida ainda pra sortear");
    }
}
