package io.escritor.presenca.ponto.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;

/**
 * Saldo acumulado do período (PRD §"jornada flexível"): soma dos saldos diários, ignorando dias
 * não úteis. Um fim de semana com marcações (alguém trabalhou sábado) não conta nem a favor nem
 * contra - simplesmente não entra na soma, igual um fim de semana sem marcação nenhuma.
 */
public final class SaldoAcumulado {

    private SaldoAcumulado() {
    }

    public static long calcular(Map<LocalDate, List<Marcacao>> marcacoesPorDia, int cargaDiariaMinutos) {
        return calcular(marcacoesPorDia, data -> cargaDiariaMinutos);
    }

    /** Carga diária por dia (histórico de carga, V59): cada dia usa a carga que valia nele, então
     * mudar a carga a partir de uma data não altera o saldo dos dias anteriores. */
    public static long calcular(Map<LocalDate, List<Marcacao>> marcacoesPorDia, ToIntFunction<LocalDate> cargaDoDia) {
        return marcacoesPorDia.entrySet().stream()
                .filter(entrada -> ehDiaUtil(entrada.getKey()))
                .mapToLong(entrada -> JornadaDiaria.saldo(entrada.getValue(), cargaDoDia.applyAsInt(entrada.getKey())))
                .sum();
    }

    private static boolean ehDiaUtil(LocalDate data) {
        DayOfWeek diaDaSemana = data.getDayOfWeek();
        return diaDaSemana != DayOfWeek.SATURDAY && diaDaSemana != DayOfWeek.SUNDAY;
    }
}
