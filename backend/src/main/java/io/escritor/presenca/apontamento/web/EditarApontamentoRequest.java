package io.escritor.presenca.apontamento.web;

import java.time.Instant;

/**
 * PATCH parcial (S4.6): campo nulo = mantém o valor atual, não-nulo = substitui. Sem `@NotNull` de
 * propósito, mesmo motivo de {@link CriarApontamentoManualRequest} - a validação (`fim` final não
 * pode ficar antes do `inicio` final) é sobre o resultado do merge, não sobre os campos soltos.
 */
public record EditarApontamentoRequest(Instant inicio, Instant fim, String descricao) {
}
