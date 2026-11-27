package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.EstadoTarefa;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** {@code projetoNome} é nulo para tarefa pessoal (o projeto pessoal não aparece como projeto).
 * {@code estadosDisponiveis} é sempre A fazer, Em andamento e Feito: o estado
 * que o projeto não tiver ganha a coluna padrão ao ser escolhido (campo mantido por compatibilidade). */
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
