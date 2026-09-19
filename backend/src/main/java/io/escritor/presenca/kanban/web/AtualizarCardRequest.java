package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

/** Mesmos campos e validação de {@link CriarCardRequest} - editar aceita definir exatamente o
 * que criar já aceitava. */
public record AtualizarCardRequest(
        @NotBlank String titulo, String descricao, Long responsavelId, LocalDate prazo, Integer estimativaMinutos) {
}
