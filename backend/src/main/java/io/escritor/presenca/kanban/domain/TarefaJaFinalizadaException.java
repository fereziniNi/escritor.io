package io.escritor.presenca.kanban.domain;

/** Tarefa já finalizada (com descrição de conclusão) não muda mais de estado por "Minhas tarefas". */
public class TarefaJaFinalizadaException extends RuntimeException {

    public TarefaJaFinalizadaException(Long cardId) {
        super("A tarefa " + cardId + " já foi finalizada");
    }
}
