package io.escritor.presenca.escritorio.domain;

/**
 * PRD §3.5: {@code AUSENTE} é automático após 5 minutos sem input (S6.8) - os demais valores são
 * definidos manualmente (S6.6) ou por entrar numa zona tipada (S6.7).
 */
public enum StatusAvatar {
    DISPONIVEL,
    FOCO,
    REUNIAO,
    ALMOCO,
    AUSENTE
}
