package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CriarCardRequest(
        @NotBlank String titulo, String descricao, Long responsavelId, LocalDate prazo, Integer estimativaMinutos) {
}
