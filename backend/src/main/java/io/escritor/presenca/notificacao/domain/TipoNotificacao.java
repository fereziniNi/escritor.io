package io.escritor.presenca.notificacao.domain;

/** Só os quatro eventos que já viravam toast/alerta passageiro e fazem sentido como histórico
 * revisável (ver comentário em {@link Notificacao}) - mensagem de chat e "alguém está perto"
 * ficam de fora de propósito. */
public enum TipoNotificacao {
    CONVITE_REUNIAO,
    TAREFA_CONCLUIDA,
    NOVA_TAREFA,
    SORTEIO_HAPPY_HOUR
}
