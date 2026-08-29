package io.escritor.presenca.ponto.web;

/**
 * CSV primeiro que PDF (S5.3): sem depender de biblioteca de geração de PDF ainda. Função pura -
 * não sabe nada de HTTP, só transforma o mesmo {@link EspelhoMesResponse} que a API já devolve em
 * JSON. Saldo acumulado do período não entra - "uma linha por dia", sem linha de resumo (PRD E4).
 */
public final class EspelhoMesCsv {

    private EspelhoMesCsv() {
    }

    public static String gerar(EspelhoMesResponse espelho) {
        StringBuilder csv = new StringBuilder("Data,Estado,Minutos Trabalhados,Saldo\n");
        for (EspelhoDiaResponse dia : espelho.dias()) {
            csv.append(dia.data()).append(',').append(dia.estado()).append(',').append(dia.minutosTrabalhados()).append(',').append(dia.saldoDia()).append('\n');
        }
        return csv.toString();
    }
}
