package io.escritor.presenca.ponto.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Máquina de estados da marcação de ponto (PRD E1): o próximo tipo válido depende só do tipo do
 * último registro do usuário (independe de data - uma jornada pode cruzar a meia-noite). O
 * fechamento/consistência do dia é um assunto separado (ver JornadaDiaria, fatia S2.8).
 */
public final class SequenciaMarcacao {

    private SequenciaMarcacao() {
    }

    public static boolean transicaoValida(TipoRegistroPonto ultimoTipo, TipoRegistroPonto novoTipo) {
        return tiposValidosApos(ultimoTipo).contains(novoTipo);
    }

    public static Set<TipoRegistroPonto> tiposValidosApos(TipoRegistroPonto ultimoTipo) {
        if (ultimoTipo == null) {
            return EnumSet.of(TipoRegistroPonto.ENTRADA);
        }

        return switch (ultimoTipo) {
            case ENTRADA, PAUSA_FIM -> EnumSet.of(TipoRegistroPonto.PAUSA_INICIO, TipoRegistroPonto.SAIDA);
            case PAUSA_INICIO -> EnumSet.of(TipoRegistroPonto.PAUSA_FIM);
            case SAIDA -> EnumSet.of(TipoRegistroPonto.ENTRADA);
        };
    }
}
