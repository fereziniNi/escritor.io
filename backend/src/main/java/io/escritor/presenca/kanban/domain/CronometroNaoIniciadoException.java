package io.escritor.presenca.kanban.domain;

/** Pausar um cronômetro sem nenhuma sessão aberta agora. */
public class CronometroNaoIniciadoException extends RuntimeException {

    public CronometroNaoIniciadoException(String mensagem) {
        super(mensagem);
    }
}
