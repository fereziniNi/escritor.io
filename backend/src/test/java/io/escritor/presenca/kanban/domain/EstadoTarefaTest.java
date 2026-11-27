package io.escritor.presenca.kanban.domain;

import static io.escritor.presenca.kanban.domain.EstadoTarefa.A_FAZER;
import static io.escritor.presenca.kanban.domain.EstadoTarefa.EM_ANDAMENTO;
import static io.escritor.presenca.kanban.domain.EstadoTarefa.FEITO;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class EstadoTarefaTest {

    // Quadros reais de produção (nomes na ordem das colunas).
    private static final List<String> BEYOND_COMITE = List.of("Fazendo", "Feito", "Backlog");
    private static final List<String> CAMBIA = List.of("A fazer", "Feito", "Backlog");
    private static final List<String> FINANZANALYST = List.of("A fazer", "Feito", "Fazendo", "Backlog");
    private static final List<String> NPS = List.of("A fazer", "Fazendo", "Feito", "Backlog");
    private static final List<String> CONTROLE_DE_ATIVOS = List.of("A fazer", "Fazendo", "Feito", "Backlog");
    private static final List<String> CHAMADOS = List.of("Fazendo");

    private static List<EstadoTarefa> estadosDe(List<String> nomes) {
        return IntStream.range(0, nomes.size())
                .mapToObj(i -> EstadoTarefa.estadoDaColuna(nomes.get(i), i, nomes.size(), false))
                .toList();
    }

    @Test
    void porNomeReconheceNomesComAcentosECaixa() {
        assertThat(EstadoTarefa.porNome("A fazer")).contains(A_FAZER);
        assertThat(EstadoTarefa.porNome("FAZENDO")).contains(EM_ANDAMENTO);
        assertThat(EstadoTarefa.porNome("Em andamento")).contains(EM_ANDAMENTO);
        assertThat(EstadoTarefa.porNome("Concluído")).contains(FEITO);
        assertThat(EstadoTarefa.porNome("Feito")).contains(FEITO);
        assertThat(EstadoTarefa.porNome("  Backlog ")).contains(A_FAZER);
        assertThat(EstadoTarefa.porNome("Revisão")).isEmpty();
        assertThat(EstadoTarefa.porNome("")).isEmpty();
        assertThat(EstadoTarefa.porNome(null)).isEmpty();
    }

    @Test
    void porNomeNaoDependeDoLocaleDaMaquina() {
        java.util.Locale original = java.util.Locale.getDefault();
        try {
            java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr-TR"));
            assertThat(EstadoTarefa.porNome("FINALIZADO")).contains(FEITO);
            assertThat(EstadoTarefa.porNome("BACKLOG")).contains(A_FAZER);
        } finally {
            java.util.Locale.setDefault(original);
        }
    }

    @Test
    void porNomeOutrosSinonimos() {
        assertThat(EstadoTarefa.porNome("Done")).contains(FEITO);
        assertThat(EstadoTarefa.porNome("Finalizadas")).contains(FEITO);
        assertThat(EstadoTarefa.porNome("Entregue")).contains(FEITO);
        assertThat(EstadoTarefa.porNome("In Progress")).contains(EM_ANDAMENTO);
        assertThat(EstadoTarefa.porNome("Doing")).contains(EM_ANDAMENTO);
        assertThat(EstadoTarefa.porNome("Execução")).contains(EM_ANDAMENTO);
        assertThat(EstadoTarefa.porNome("To Do")).contains(A_FAZER);
        assertThat(EstadoTarefa.porNome("AFazer")).contains(A_FAZER);
        assertThat(EstadoTarefa.porNome("Pendentes")).contains(A_FAZER);
        assertThat(EstadoTarefa.porNome("Planejamento")).contains(A_FAZER);
    }

    @Test
    void estadoDaColunaBeyondComite() {
        assertThat(estadosDe(BEYOND_COMITE)).containsExactly(EM_ANDAMENTO, FEITO, A_FAZER);
    }

    @Test
    void estadoDaColunaCambIA() {
        assertThat(estadosDe(CAMBIA)).containsExactly(A_FAZER, FEITO, A_FAZER);
    }

    @Test
    void estadoDaColunaFinanzAnalyst() {
        assertThat(estadosDe(FINANZANALYST)).containsExactly(A_FAZER, FEITO, EM_ANDAMENTO, A_FAZER);
    }

    @Test
    void estadoDaColunaNpsEControleDeAtivos() {
        assertThat(estadosDe(NPS)).containsExactly(A_FAZER, EM_ANDAMENTO, FEITO, A_FAZER);
        assertThat(estadosDe(CONTROLE_DE_ATIVOS)).containsExactly(A_FAZER, EM_ANDAMENTO, FEITO, A_FAZER);
    }

    @Test
    void estadoDaColunaChamadosDeUmaColunaFazendo() {
        assertThat(estadosDe(CHAMADOS)).containsExactly(EM_ANDAMENTO);
    }

    @Test
    void colunaSemNomeReconhecidoCaiNaRegraPosicional() {
        assertThat(EstadoTarefa.estadoDaColuna("Revisão", 0, 1, false)).isEqualTo(A_FAZER);
        assertThat(EstadoTarefa.estadoDaColuna("Revisão", 0, 5, false)).isEqualTo(A_FAZER);
        assertThat(EstadoTarefa.estadoDaColuna("Revisão", 2, 5, false)).isEqualTo(EM_ANDAMENTO);
        assertThat(EstadoTarefa.estadoDaColuna("Revisão", 4, 5, false)).isEqualTo(FEITO);
        assertThat(EstadoTarefa.estadoDaColuna(null, 1, 2, false)).isEqualTo(FEITO);
    }

    @Test
    void concluidoVenceONomeEAPosicao() {
        assertThat(EstadoTarefa.estadoDaColuna("Backlog", 2, 3, true)).isEqualTo(FEITO);
        assertThat(EstadoTarefa.estadoDaColuna("Fazendo", 0, 1, true)).isEqualTo(FEITO);
    }

    @Test
    void indiceDoDestinoBeyondComite() {
        assertThat(EstadoTarefa.indiceDoDestino(A_FAZER, BEYOND_COMITE)).contains(2);
        assertThat(EstadoTarefa.indiceDoDestino(EM_ANDAMENTO, BEYOND_COMITE)).contains(0);
        assertThat(EstadoTarefa.indiceDoDestino(FEITO, BEYOND_COMITE)).contains(1);
    }

    @Test
    void indiceDoDestinoEscolheAPrimeiraColunaDoEstado() {
        assertThat(EstadoTarefa.indiceDoDestino(A_FAZER, CAMBIA)).contains(0);
        assertThat(EstadoTarefa.indiceDoDestino(EM_ANDAMENTO, CAMBIA)).isEmpty();
        assertThat(EstadoTarefa.indiceDoDestino(EM_ANDAMENTO, FINANZANALYST)).contains(2);
    }

    @Test
    void indiceDoDestinoEmProjetoDeUmaColunaFazendo() {
        assertThat(EstadoTarefa.indiceDoDestino(EM_ANDAMENTO, CHAMADOS)).contains(0);
        assertThat(EstadoTarefa.indiceDoDestino(A_FAZER, CHAMADOS)).isEmpty();
        assertThat(EstadoTarefa.indiceDoDestino(FEITO, CHAMADOS)).isEmpty();
    }

    @Test
    void indiceDoDestinoSemColunasEhVazio() {
        assertThat(EstadoTarefa.indiceDoDestino(A_FAZER, List.of())).isEmpty();
    }
}
