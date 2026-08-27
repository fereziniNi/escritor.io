package io.escritor.presenca.ponto.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * minutos_trabalhados = Σ(SAIDA − ENTRADA) − Σ(PAUSA_FIM − PAUSA_INICIO) (PRD §"jornada
 * flexível"). Só intervalos fechados contam: uma ENTRADA ou PAUSA_INICIO sem par correspondente
 * ainda (jornada em andamento, ou dia inconsistente) simplesmente não contribui - fechar o dia é
 * responsabilidade de outra peça (S2.8), não desta função pura.
 */
public final class JornadaDiaria {

    private JornadaDiaria() {
    }

    public static long minutosTrabalhados(List<Marcacao> registros) {
        long minutos = 0;
        Instant entradaAberta = null;
        Instant pausaAberta = null;

        for (Marcacao marcacao : registros) {
            switch (marcacao.tipo()) {
                case ENTRADA -> entradaAberta = marcacao.momento();
                case SAIDA -> {
                    if (entradaAberta != null) {
                        minutos += Duration.between(entradaAberta, marcacao.momento()).toMinutes();
                        entradaAberta = null;
                    }
                }
                case PAUSA_INICIO -> pausaAberta = marcacao.momento();
                case PAUSA_FIM -> {
                    if (pausaAberta != null) {
                        minutos -= Duration.between(pausaAberta, marcacao.momento()).toMinutes();
                        pausaAberta = null;
                    }
                }
            }
        }

        return minutos;
    }

    public static long saldo(List<Marcacao> registros, int cargaDiariaMinutos) {
        return minutosTrabalhados(registros) - cargaDiariaMinutos;
    }
}
