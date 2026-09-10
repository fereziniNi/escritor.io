package io.escritor.presenca.kanban.domain;

/** Iniciar um cronômetro que já tem uma sessão aberta, ou uma tarefa já finalizada. */
public class CronometroJaEmAndamentoException extends RuntimeException {

    public CronometroJaEmAndamentoException(String mensagem) {
        super(mensagem);
    }
}
