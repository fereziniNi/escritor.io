package io.escritor.presenca.escritorio.domain;

/**
 * {@code AUSENTE} é uma escolha manual normal (S6.6, `OPCOES_STATUS` no front-end) como
 * {@code FOCO}/{@code REUNIAO}/{@code ALMOCO} - pedido do usuário: "ele nunca deve redirecionar
 * para ausente a menos que ele escolha essa opção". Já existiram dois gatilhos automáticos pra
 * esse status (5 minutos sem input, e entrar na zona "Fora do trabalho" - {@link
 * io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler#STATUS_POR_ZONA}), os dois removidos
 * a pedido do usuário; hoje só vira {@code AUSENTE} quem escolhe isso na mão.
 *
 * <p>{@code OFFLINE} é automático, por desconexão (não inatividade) -
 * {@link io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler#afterConnectionClosed} marca
 * quem sai com esse status em vez de remover do estado, pra o avatar continuar visível (apagado,
 * exatamente onde estava) pros demais até a pessoa reconectar. Não é escolhível manualmente
 * (frontend não lista no seletor de status).
 */
public enum StatusAvatar {
    DISPONIVEL,
    FOCO,
    REUNIAO,
    ALMOCO,
    AUSENTE,
    OFFLINE
}
