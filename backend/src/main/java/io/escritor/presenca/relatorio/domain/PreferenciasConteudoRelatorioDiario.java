package io.escritor.presenca.relatorio.domain;

/**
 * Pedido do usuário: "adicionar mais informações no relatório diário, mas deixe personalizado
 * para o admin" - quais blocos de conteúdo entram no resumo (ver {@code RelatorioDiarioService}),
 * agrupados num tipo só em vez de {@link ConfiguracaoRelatorioDiario} carregar seis campos soltos.
 * {@code ponto}/{@code tarefasCriadasMovidas} são o comportamento de sempre (existiam antes desta
 * personalização); os outros três são blocos novos, todos opt-in.
 */
public record PreferenciasConteudoRelatorioDiario(
        boolean ponto,
        boolean tarefasCriadasMovidas,
        boolean tarefasConcluidas,
        boolean reunioes,
        boolean ausencias,
        boolean resumoEquipe) {

    /** O que já existia antes desta personalização - ponto + tarefas criadas/movidas, mais nada. */
    public static PreferenciasConteudoRelatorioDiario padrao() {
        return new PreferenciasConteudoRelatorioDiario(true, true, false, false, false, false);
    }
}
