package io.escritor.presenca.ponto.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class SequenciaMarcacaoTest {

    @Test
    void semRegistroAnteriorSoEntradaEValida() {
        assertThat(SequenciaMarcacao.transicaoValida(null, TipoRegistroPonto.ENTRADA)).isTrue();
        assertThat(SequenciaMarcacao.transicaoValida(null, TipoRegistroPonto.SAIDA)).isFalse();
        assertThat(SequenciaMarcacao.transicaoValida(null, TipoRegistroPonto.PAUSA_INICIO)).isFalse();
        assertThat(SequenciaMarcacao.transicaoValida(null, TipoRegistroPonto.PAUSA_FIM)).isFalse();
    }

    @ParameterizedTest(name = "após {0}, marcar {1} é válido? {2}")
    @CsvSource({
        "ENTRADA, ENTRADA, false",
        "ENTRADA, SAIDA, true",
        "ENTRADA, PAUSA_INICIO, true",
        "ENTRADA, PAUSA_FIM, false",
        "SAIDA, ENTRADA, true",
        "SAIDA, SAIDA, false",
        "SAIDA, PAUSA_INICIO, false",
        "SAIDA, PAUSA_FIM, false",
        "PAUSA_INICIO, ENTRADA, false",
        "PAUSA_INICIO, SAIDA, false",
        "PAUSA_INICIO, PAUSA_INICIO, false",
        "PAUSA_INICIO, PAUSA_FIM, true",
        "PAUSA_FIM, ENTRADA, false",
        "PAUSA_FIM, SAIDA, true",
        "PAUSA_FIM, PAUSA_INICIO, true",
        "PAUSA_FIM, PAUSA_FIM, false",
    })
    void tabelaDeTransicoesValidas(TipoRegistroPonto ultimo, TipoRegistroPonto novo, boolean esperado) {
        assertThat(SequenciaMarcacao.transicaoValida(ultimo, novo)).isEqualTo(esperado);
    }

    @Test
    void quemEstaEmPausaSoTemRetomarComoOpcao() {
        assertThat(SequenciaMarcacao.tiposValidosApos(TipoRegistroPonto.PAUSA_INICIO))
                .containsExactly(TipoRegistroPonto.PAUSA_FIM);
    }

    @Test
    void jornadaAbertaOfereceParaOuSair() {
        assertThat(SequenciaMarcacao.tiposValidosApos(TipoRegistroPonto.ENTRADA))
                .containsExactlyInAnyOrder(TipoRegistroPonto.PAUSA_INICIO, TipoRegistroPonto.SAIDA);
    }
}
