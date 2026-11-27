package io.escritor.presenca.kanban.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EstadoTarefaTest {

    @Test
    void umaColunaEhSempreAFazer() {
        assertThat(EstadoTarefa.de(0, 1, false)).isEqualTo(EstadoTarefa.A_FAZER);
    }

    @Test
    void duasColunasSaoAFazerEFeito() {
        assertThat(EstadoTarefa.de(0, 2, false)).isEqualTo(EstadoTarefa.A_FAZER);
        assertThat(EstadoTarefa.de(1, 2, false)).isEqualTo(EstadoTarefa.FEITO);
    }

    @Test
    void cincoColunasPrimeiraUltimaEMeio() {
        assertThat(EstadoTarefa.de(0, 5, false)).isEqualTo(EstadoTarefa.A_FAZER);
        assertThat(EstadoTarefa.de(1, 5, false)).isEqualTo(EstadoTarefa.EM_ANDAMENTO);
        assertThat(EstadoTarefa.de(2, 5, false)).isEqualTo(EstadoTarefa.EM_ANDAMENTO);
        assertThat(EstadoTarefa.de(3, 5, false)).isEqualTo(EstadoTarefa.EM_ANDAMENTO);
        assertThat(EstadoTarefa.de(4, 5, false)).isEqualTo(EstadoTarefa.FEITO);
    }

    @Test
    void concluidoEhFeitoMesmoNaColunaDoMeioOuNaPrimeira() {
        assertThat(EstadoTarefa.de(2, 5, true)).isEqualTo(EstadoTarefa.FEITO);
        assertThat(EstadoTarefa.de(0, 1, true)).isEqualTo(EstadoTarefa.FEITO);
    }

    @Test
    void indiceDaColunaParaCadaDestino() {
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.A_FAZER, 5)).isEqualTo(0);
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.EM_ANDAMENTO, 5)).isEqualTo(1);
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.EM_ANDAMENTO, 3)).isEqualTo(1);
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.FEITO, 5)).isEqualTo(4);
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.FEITO, 2)).isEqualTo(1);
        assertThat(EstadoTarefa.indiceDaColuna(EstadoTarefa.FEITO, 1)).isEqualTo(0);
    }

    @Test
    void emAndamentoComDuasColunasOuMenosLancaIllegalArgument() {
        assertThatThrownBy(() -> EstadoTarefa.indiceDaColuna(EstadoTarefa.EM_ANDAMENTO, 2))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> EstadoTarefa.indiceDaColuna(EstadoTarefa.EM_ANDAMENTO, 1))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
