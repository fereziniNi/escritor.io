package io.escritor.presenca.kanban.domain;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

/**
 * Estado de uma tarefa em "Minhas tarefas", derivado da coluna do card no quadro do projeto - nada
 * é persistido. O estado vem do NOME da coluna ("Fazendo", "Feito", "Backlog"...); só quando o nome
 * não é reconhecido vale a posição (primeira = A fazer, última = Feito, as do meio = Em andamento).
 */
public enum EstadoTarefa {
    A_FAZER,
    EM_ANDAMENTO,
    FEITO;

    private static final List<String> TERMOS_FEITO = List.of("feito", "conclu", "done", "finaliz", "entregue");
    private static final List<String> TERMOS_EM_ANDAMENTO = List.of("fazendo", "andamento", "progress", "doing", "execu");
    private static final List<String> TERMOS_A_FAZER =
            List.of("a fazer", "afazer", "todo", "to do", "backlog", "pendente", "planej");

    /** Estado sugerido pelo nome da coluna (sem acento, sem diferenciar caixa); vazio se não reconhecido. */
    public static Optional<EstadoTarefa> porNome(String nomeDaColuna) {
        if (nomeDaColuna == null) {
            return Optional.empty();
        }
        String nome = Normalizer.normalize(nomeDaColuna.trim().toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        // A ordem importa: "a fazer" não pode cair em "fazendo" e vice-versa.
        if (contemAlgum(nome, TERMOS_FEITO)) {
            return Optional.of(FEITO);
        }
        if (contemAlgum(nome, TERMOS_EM_ANDAMENTO)) {
            return Optional.of(EM_ANDAMENTO);
        }
        if (contemAlgum(nome, TERMOS_A_FAZER)) {
            return Optional.of(A_FAZER);
        }
        return Optional.empty();
    }

    private static boolean contemAlgum(String nome, List<String> termos) {
        return termos.stream().anyMatch(nome::contains);
    }

    /** Estado de um card na coluna {@code nomeDaColuna}. {@code posicaoDaColuna} é o índice 0-based na
     * lista de colunas ordenada por {@code ordem}, usado só se o nome não for reconhecido. Card já
     * finalizado ({@code concluido}) é sempre FEITO, esteja em que coluna estiver. */
    public static EstadoTarefa estadoDaColuna(
            String nomeDaColuna, int posicaoDaColuna, int totalDeColunas, boolean concluido) {
        if (concluido) {
            return FEITO;
        }
        return porNome(nomeDaColuna).orElseGet(() -> porPosicao(posicaoDaColuna, totalDeColunas));
    }

    private static EstadoTarefa porPosicao(int posicaoDaColuna, int totalDeColunas) {
        if (totalDeColunas <= 1 || posicaoDaColuna <= 0) {
            return A_FAZER;
        }
        if (posicaoDaColuna >= totalDeColunas - 1) {
            return FEITO;
        }
        return EM_ANDAMENTO;
    }

    /** Índice (na lista ordenada) da primeira coluna que representa {@code destino}; vazio se não há. */
    public static Optional<Integer> indiceDoDestino(EstadoTarefa destino, List<String> nomesDasColunasOrdenadas) {
        int total = nomesDasColunasOrdenadas.size();
        return IntStream.range(0, total)
                .filter(i -> estadoDaColuna(nomesDasColunasOrdenadas.get(i), i, total, false) == destino)
                .boxed()
                .findFirst();
    }

    /** Estados que o quadro suporta (os das suas colunas), na ordem A fazer, Em andamento, Feito. */
    public static List<EstadoTarefa> disponiveis(List<String> nomesDasColunasOrdenadas) {
        return Arrays.stream(values())
                .filter(e -> indiceDoDestino(e, nomesDasColunasOrdenadas).isPresent())
                .toList();
    }
}
