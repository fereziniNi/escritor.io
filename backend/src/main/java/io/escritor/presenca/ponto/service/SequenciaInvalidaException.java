package io.escritor.presenca.ponto.service;

import io.escritor.presenca.ponto.domain.TipoRegistroPonto;

public class SequenciaInvalidaException extends RuntimeException {

    public SequenciaInvalidaException(TipoRegistroPonto ultimoTipo, TipoRegistroPonto tipoSolicitado) {
        super("Não é possível marcar %s logo após %s".formatted(
                tipoSolicitado, ultimoTipo == null ? "nenhum registro anterior" : ultimoTipo));
    }
}
