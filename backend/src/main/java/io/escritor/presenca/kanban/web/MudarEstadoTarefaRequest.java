package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.EstadoTarefa;
import jakarta.validation.constraints.NotNull;

public record MudarEstadoTarefaRequest(@NotNull EstadoTarefa estado) {}
