package io.escritor.presenca.ponto.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Saldo acumulado do período (PRD §"jornada flexível"): soma dos saldos diários, ignorando dias
 * não úteis. Um fim de semana com marcações (alguém trabalhou sábado) não conta nem a favor nem
 * contra - simplesmente não entra na soma, igual um fim de semana sem marcação nenhuma.
 */
public final class SaldoAcumulado {

    private SaldoAcumulado() {
    }

    public static long calcular(Map<LocalDate, List<Marcacao>> marcacoesPorDia, int cargaDiariaMinutos) {
        return marcacoesPorDia.entrySet().stream()
                .filter(entrada -> ehDiaUtil(entrada.getKey()))
                .mapToLong(entrada -> JornadaDiaria.saldo(entrada.getValue(), cargaDiariaMinutos))
                .sum();
    }

    private static boolean ehDiaUtil(LocalDate data) {
        DayOfWeek diaDaSemana = data.getDayOfWeek();
        return diaDaSemana != DayOfWeek.SATURDAY && diaDaSemana != DayOfWeek.SUNDAY;
    }
}
