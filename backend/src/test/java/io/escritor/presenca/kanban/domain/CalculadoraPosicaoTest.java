package io.escritor.presenca.kanban.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CalculadoraPosicaoTest {

    @Test
    void colunaVaziaUsaPosicaoBase() {
        double posicao = CalculadoraPosicao.entre(null, null);

        assertThat(posicao).isEqualTo(CalculadoraPosicao.POSICAO_BASE);
    }

    @Test
    void inserirNoFimFicaDepoisDoUltimo() {
        double posicao = CalculadoraPosicao.entre(1024.0, null);

        assertThat(posicao).isGreaterThan(1024.0);
    }

    @Test
    void inserirNoInicioFicaAntesDoPrimeiro() {
        double posicao = CalculadoraPosicao.entre(null, 1024.0);

        assertThat(posicao).isLessThan(1024.0);
    }

    @Test
    void inserirEntreDoisFicaEstritamenteNoMeio() {
        double posicao = CalculadoraPosicao.entre(1024.0, 2048.0);

        assertThat(posicao).isGreaterThan(1024.0).isLessThan(2048.0);
    }

    @Test
    void inserirEntreDoisMuitoProximosAindaFicaEstritamenteEntreEles() {
        double posicao = CalculadoraPosicao.entre(1.0, 1.0000000002);

        assertThat(posicao).isGreaterThan(1.0).isLessThan(1.0000000002);
    }
}
