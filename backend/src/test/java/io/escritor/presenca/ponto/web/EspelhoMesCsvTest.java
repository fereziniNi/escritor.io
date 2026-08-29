package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.EstadoDia;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Função pura testada isoladamente (S5.3), mesmo espírito de {@code formatarDuracao}/
 * {@code HashEncadeado} - geração de CSV não depende de request/response, só transforma dados.
 */
class EspelhoMesCsvTest {

    @Test
    void geraCabecalhoEUmaLinhaPorDia() {
        var espelho = new EspelhoMesResponse(
                List.of(
                        new EspelhoDiaResponse(LocalDate.parse("2026-01-12"), EstadoDia.FECHADA, 540, 60),
                        new EspelhoDiaResponse(LocalDate.parse("2026-01-13"), EstadoDia.ABERTA, 480, 0)),
                60);

        String csv = EspelhoMesCsv.gerar(espelho);

        assertThat(csv)
                .isEqualTo(
                        """
                        Data,Estado,Minutos Trabalhados,Saldo
                        2026-01-12,FECHADA,540,60
                        2026-01-13,ABERTA,480,0
                        """);
    }

    @Test
    void espelhoSemDiasGeraSoOCabecalho() {
        var espelho = new EspelhoMesResponse(List.of(), 0);

        String csv = EspelhoMesCsv.gerar(espelho);

        assertThat(csv).isEqualTo("Data,Estado,Minutos Trabalhados,Saldo\n");
    }

    @Test
    void saldoNegativoNaoQuebraOFormato() {
        var espelho = new EspelhoMesResponse(List.of(new EspelhoDiaResponse(LocalDate.parse("2026-01-13"), EstadoDia.INCONSISTENTE, 0, -480)), -480);

        String csv = EspelhoMesCsv.gerar(espelho);

        assertThat(csv).isEqualTo("Data,Estado,Minutos Trabalhados,Saldo\n2026-01-13,INCONSISTENTE,0,-480\n");
    }
}
