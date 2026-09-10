package io.escritor.presenca.relatorio.web;

import java.util.List;

/**
 * Estatísticas de equipe - sempre restritas a quem o requisitante enxerga
 * ({@code VisibilidadeUsuarioService#listarUsuariosVisiveis}: colaborador só a si mesmo, gestor
 * quem está nos mesmos projetos, admin todo mundo). Pra colaborador, os rankings colapsam pra uma
 * pessoa só - não é um bug, é a mesma regra de visibilidade de sempre.
 */
public record EstatisticasEquipeResponse(
        List<RankingPessoaResponse> rankingHorasTrabalhadas,
        List<RankingPessoaResponse> rankingTarefasConcluidas,
        List<RankingPessoaResponse> rankingReunioes,
        List<Integer> reunioesPorHoraDoDia) {
}
