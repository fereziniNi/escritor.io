package io.escritor.presenca.identidade.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class UsuarioCargaDiariaTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 27);

    private static Usuario colaboradora() {
        return new Usuario("Ana", "ana@escritor.io", Papel.COLABORADOR, 360);
    }

    @Test
    void semMudancaValeACargaInicialEmQualquerData() {
        Usuario ana = colaboradora();

        assertThat(ana.cargaDiariaEm(LocalDate.of(2025, 1, 1))).isEqualTo(360);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2030, 1, 1))).isEqualTo(360);
    }

    @Test
    void mudancaVaiValerSoAPartirDaDataEMesesAnterioresNaoMudam() {
        Usuario ana = colaboradora();

        ana.definirCargaDiaria(480, LocalDate.of(2026, 11, 30), HOJE);

        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 10, 15))).isEqualTo(360);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 11, 27))).isEqualTo(360);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 11, 29))).isEqualTo(360);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 11, 30))).isEqualTo(480);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 12, 15))).isEqualTo(480);
    }

    @Test
    void cargaGuardadaNoUsuarioAcompanhaOQueValeHoje() {
        Usuario ana = colaboradora();

        ana.definirCargaDiaria(480, LocalDate.of(2026, 11, 30), HOJE);
        assertThat(ana.getCargaDiariaMinutos()).isEqualTo(360); // ainda não começou

        ana.definirCargaDiaria(480, LocalDate.of(2026, 11, 20), HOJE);
        assertThat(ana.getCargaDiariaMinutos()).isEqualTo(480); // retroativa até 20/11 já vale hoje
    }

    @Test
    void mesmaDataDeNovoCorrigeOValorSemDuplicar() {
        Usuario ana = colaboradora();

        ana.definirCargaDiaria(480, LocalDate.of(2026, 11, 30), HOJE);
        ana.definirCargaDiaria(420, LocalDate.of(2026, 11, 30), HOJE);

        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 12, 1))).isEqualTo(420);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 11, 29))).isEqualTo(360);
    }

    @Test
    void variasMudancasCadaUmaValeNoSeuPeriodo() {
        Usuario ana = colaboradora();

        ana.definirCargaDiaria(480, LocalDate.of(2026, 12, 1), HOJE);
        ana.definirCargaDiaria(300, LocalDate.of(2027, 3, 1), HOJE);

        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 11, 30))).isEqualTo(360);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2026, 12, 31))).isEqualTo(480);
        assertThat(ana.cargaDiariaEm(LocalDate.of(2027, 3, 1))).isEqualTo(300);
    }
}
