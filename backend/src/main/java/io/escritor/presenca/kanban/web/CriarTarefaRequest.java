package io.escritor.presenca.kanban.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

/** {@code projetoId} nulo cria a tarefa no projeto pessoal do usuário. */
public record CriarTarefaRequest(
        @NotBlank String titulo, Long projetoId, LocalDate prazo, @Positive Integer estimativaMinutos) {}
