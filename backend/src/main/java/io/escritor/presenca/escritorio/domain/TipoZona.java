package io.escritor.presenca.escritorio.domain;

public enum TipoZona {
    FOCO,
    REUNIAO,
    CAFE,
    ATENDIMENTO,
    LIVRE,
    HAPPY_HOUR,
    // Pedido do usuário: "cabines fechadas para caso os usuários não possam e não queiram escutar
    // o barulho da sala" - zona isolada de verdade (ver `proximidade.ts` no frontend, onde o
    // pareamento de voz por proximidade é bloqueado através das bordas de uma CABINE).
    CABINE
}
