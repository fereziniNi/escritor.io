package io.escritor.presenca.ponto.domain;

import java.time.Instant;
import java.util.List;

/**
 * Estado de fechamento de um dia, calculado sob demanda (não persistido, não depende de job
 * agendado): um dia cuja última marcação não é {@code SAIDA} fica {@code ABERTA} até o fim do
 * dia (exclusivo) e {@code INCONSISTENTE} a partir daí - "falta SAIDA até a virada" (PRD §"jornada
 * flexível"). Assume {@code registrosDoDia} ordenado cronologicamente.
 */
public enum EstadoDia {
    ABERTA,
    FECHADA,
    INCONSISTENTE;

    public static EstadoDia calcular(List<Marcacao> registrosDoDia, Instant fimDoDia, Instant agora) {
        if (registrosDoDia.isEmpty()) {
            return ABERTA;
        }

        Marcacao ultima = registrosDoDia.get(registrosDoDia.size() - 1);
        if (ultima.tipo() == TipoRegistroPonto.SAIDA) {
            return FECHADA;
        }

        return agora.isBefore(fimDoDia) ? ABERTA : INCONSISTENTE;
    }
}
