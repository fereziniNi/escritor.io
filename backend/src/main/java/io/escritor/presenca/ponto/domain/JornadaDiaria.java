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

    /**
     * Como {@link #minutosTrabalhados}, mas em segundos e incluindo o segmento em andamento (uma
     * ENTRADA/PAUSA_FIM ainda sem par) até {@code agora} - usado só pelo cronômetro ao vivo do
     * frontend (`CronometroTrabalho`), nunca pro saldo oficial do dia, que continua contando só
     * intervalos fechados de propósito (ver javadoc da classe). Uma pausa em andamento *não* soma
     * daí pra frente - o efeito é o cronômetro ficar parado (congelado) durante a pausa, porque o
     * trecho aberto é contado só até o início dela, não até {@code agora}.
     */
    public static long segundosTrabalhadosAteAgora(List<Marcacao> registros, Instant agora) {
        long segundos = 0;
        Instant entradaAberta = null;
        Instant pausaAberta = null;

        for (Marcacao marcacao : registros) {
            switch (marcacao.tipo()) {
                case ENTRADA -> entradaAberta = marcacao.momento();
                case SAIDA -> {
                    if (entradaAberta != null) {
                        segundos += Duration.between(entradaAberta, marcacao.momento()).toSeconds();
                        entradaAberta = null;
                    }
                }
                case PAUSA_INICIO -> pausaAberta = marcacao.momento();
                case PAUSA_FIM -> {
                    if (pausaAberta != null) {
                        segundos -= Duration.between(pausaAberta, marcacao.momento()).toSeconds();
                        pausaAberta = null;
                    }
                }
            }
        }

        if (entradaAberta != null) {
            Instant fimEfetivo = pausaAberta != null ? pausaAberta : agora;
            segundos += Duration.between(entradaAberta, fimEfetivo).toSeconds();
        }

        return segundos;
    }
}
