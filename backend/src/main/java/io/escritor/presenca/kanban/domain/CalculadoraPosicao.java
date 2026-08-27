package io.escritor.presenca.kanban.domain;

/**
 * Posição fracionária pra ordenar cards (PRD §3.3): mover um card é sempre recalcular a posição
 * dele sozinho, nunca renumerar a coluna inteira. {@code anterior}/{@code proxima} são as
 * posições dos vizinhos onde o card vai entrar - {@code null} significa "sem vizinho desse lado"
 * (início/fim da coluna, ou coluna vazia). Sem rebalanceamento: na escala do PRD (até 10
 * usuários) a precisão de {@code double} aguenta muitas inserções na mesma lacuna antes de
 * qualquer problema.
 */
public final class CalculadoraPosicao {

    public static final double POSICAO_BASE = 1024.0;
    private static final double PASSO = 1024.0;

    private CalculadoraPosicao() {
    }

    public static double entre(Double anterior, Double proxima) {
        if (anterior == null && proxima == null) {
            return POSICAO_BASE;
        }
        if (anterior == null) {
            return proxima - PASSO;
        }
        if (proxima == null) {
            return anterior + PASSO;
        }
        return anterior + (proxima - anterior) / 2;
    }
}
