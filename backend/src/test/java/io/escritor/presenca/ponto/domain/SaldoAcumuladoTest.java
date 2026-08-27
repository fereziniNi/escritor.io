package io.escritor.presenca.ponto.domain;

import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.ENTRADA;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.SAIDA;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SaldoAcumuladoTest {

    private static Marcacao marcacao(TipoRegistroPonto tipo, String isoInstant) {
        return new Marcacao(tipo, Instant.parse(isoInstant));
    }

    @Test
    void somaOSaldoDosDiasUteisDoPeriodo() {
        // segunda-feira: trabalhou 9h (saldo +60 pra carga de 480)
        List<Marcacao> segunda = List.of(
                marcacao(ENTRADA, "2026-01-12T09:00:00Z"), marcacao(SAIDA, "2026-01-12T18:00:00Z"));
        // terça-feira: trabalhou 7h (saldo -60)
        List<Marcacao> terca = List.of(
                marcacao(ENTRADA, "2026-01-13T09:00:00Z"), marcacao(SAIDA, "2026-01-13T16:00:00Z"));

        Map<LocalDate, List<Marcacao>> porDia =
                Map.of(LocalDate.of(2026, 1, 12), segunda, LocalDate.of(2026, 1, 13), terca);

        assertThat(SaldoAcumulado.calcular(porDia, 480)).isZero();
    }

    @Test
    void ignoraFimDeSemanaMesmoComMarcacoes() {
        // sábado: trabalhou 4h - não deveria contar nem pra bem nem pra mal
        List<Marcacao> sabado = List.of(
                marcacao(ENTRADA, "2026-01-17T09:00:00Z"), marcacao(SAIDA, "2026-01-17T13:00:00Z"));
        // domingo: nada
        List<Marcacao> domingo = List.of();
        // segunda: trabalhou exatamente a carga
        List<Marcacao> segunda = List.of(
                marcacao(ENTRADA, "2026-01-19T09:00:00Z"), marcacao(SAIDA, "2026-01-19T17:00:00Z"));

        Map<LocalDate, List<Marcacao>> porDia = Map.of(
                LocalDate.of(2026, 1, 17), sabado,
                LocalDate.of(2026, 1, 18), domingo,
                LocalDate.of(2026, 1, 19), segunda);

        assertThat(SaldoAcumulado.calcular(porDia, 480)).isZero();
    }

    @Test
    void periodoSemNenhumDiaUtilDaZero() {
        Map<LocalDate, List<Marcacao>> porDia = Map.of(LocalDate.of(2026, 1, 17), List.of());

        assertThat(SaldoAcumulado.calcular(porDia, 480)).isZero();
    }

    @Test
    void periodoVazioDaZero() {
        assertThat(SaldoAcumulado.calcular(Map.of(), 480)).isZero();
    }

    @Test
    void saldoAcumuladoPodeSerNegativo() {
        List<Marcacao> segunda = List.of(
                marcacao(ENTRADA, "2026-01-12T09:00:00Z"), marcacao(SAIDA, "2026-01-12T12:00:00Z"));
        Map<LocalDate, List<Marcacao>> porDia = Map.of(LocalDate.of(2026, 1, 12), segunda);

        assertThat(SaldoAcumulado.calcular(porDia, 480)).isEqualTo(3 * 60 - 480);
    }
}
