package io.escritor.presenca.apontamento.web;

import java.time.Instant;

/**
 * Sem `@NotNull` em nenhum campo de propósito: a regra "minutos OU início+fim, não os dois, nem
 * nenhum" é cross-field e não cabe em Bean Validation simples - {@code ApontamentoService.criarManual}
 * valida a combinação (`LancamentoManualInvalidoException`, 400).
 */
public record CriarApontamentoManualRequest(Instant inicio, Instant fim, Integer minutos, String descricao) {
}
