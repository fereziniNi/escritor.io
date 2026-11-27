package io.escritor.presenca.kanban.domain;

/**
 * Estado de uma tarefa em "Minhas tarefas", derivado da posição da coluna do card no quadro do
 * projeto (primeira = A fazer, última = Feito, as do meio = Em andamento) - nada é persistido.
 */
public enum EstadoTarefa {
    A_FAZER,
    EM_ANDAMENTO,
    FEITO;

    /** {@code posicaoDaColuna} é o índice 0-based na lista de colunas ordenada por {@code ordem}.
     * Card já finalizado ({@code concluido}) é sempre FEITO, esteja em que coluna estiver. */
    public static EstadoTarefa de(int posicaoDaColuna, int totalDeColunas, boolean concluido) {
        if (concluido) {
            return FEITO;
        }
        if (totalDeColunas <= 1 || posicaoDaColuna <= 0) {
            return A_FAZER;
        }
        if (posicaoDaColuna >= totalDeColunas - 1) {
            return FEITO;
        }
        return EM_ANDAMENTO;
    }

    /** Índice (na lista ordenada de colunas) da coluna que representa {@code destino}. */
    public static int indiceDaColuna(EstadoTarefa destino, int totalDeColunas) {
        return switch (destino) {
            case A_FAZER -> 0;
            case FEITO -> Math.max(totalDeColunas - 1, 0);
            case EM_ANDAMENTO -> {
                if (totalDeColunas <= 2) {
                    throw new IllegalArgumentException("Projeto sem etapa intermediária");
                }
                yield 1;
            }
        };
    }
}
