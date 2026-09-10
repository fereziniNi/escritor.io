package io.escritor.presenca.relatorio.web;

import java.util.List;

/**
 * Estatísticas de uma pessoa num período. {@code minutosPorHoraDoDia} tem sempre 24 posições
 * (índice = hora UTC, 0-23) - a hora com mais minutos é "o horário que mais trabalhou" (pedido do
 * usuário), calculado no frontend a partir da lista (evita mandar "o pico" pronto e a lista
 * inteira ao mesmo tempo, de forma redundante).
 *
 * {@code projetosConcluidos} NÃO é filtrado pelo período - {@code Projeto} não guarda quando foi
 * concluído, só o status atual; é uma contagem de "todos os tempos", rotulada como tal no
 * frontend pra não sugerir um recorte que os dados não têm.
 */
public record EstatisticasPessoaisResponse(
        long totalMinutosTrabalhados,
        int diasTrabalhados,
        long mediaMinutosPorDiaTrabalhado,
        int reunioesParticipadas,
        int tarefasConcluidas,
        List<TarefaConcluidaResponse> tarefasConcluidasDetalhe,
        int projetosConcluidos,
        List<Integer> minutosPorHoraDoDia) {
}
