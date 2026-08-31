package io.escritor.presenca.escritorio.domain;

/**
 * PRD §3.5: {@code AUSENTE} é automático após 5 minutos sem input (S6.8) - os demais valores são
 * definidos manualmente (S6.6) ou por entrar numa zona tipada (S6.7). {@code OFFLINE} é automático
 * também, mas por desconexão (não inatividade) - {@link io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler#afterConnectionClosed}
 * marca quem sai com esse status em vez de remover do estado, pra o avatar continuar visível
 * (estacionado em "Fora do trabalho") pros demais até a pessoa reconectar. Nenhum dos dois é
 * escolhível manualmente pelo usuário (frontend não lista nem um nem outro no seletor de status).
 */
public enum StatusAvatar {
    DISPONIVEL,
    FOCO,
    REUNIAO,
    ALMOCO,
    AUSENTE,
    OFFLINE
}
