package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.EstadoTarefa;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** {@code projetoNome} é nulo para tarefa pessoal (o projeto pessoal não aparece como projeto).
 * {@code estadosDisponiveis} são os estados que o quadro do projeto suporta. */
public record TarefaResponse(
        Long cardId,
        String titulo,
        Long projetoId,
        String projetoNome,
        boolean pessoal,
        EstadoTarefa estado,
        LocalDate prazo,
        Integer estimativaMinutos,
        Instant concluidoEm,
        List<EstadoTarefa> estadosDisponiveis) {}
