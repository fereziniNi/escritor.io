package io.escritor.presenca.ponto.domain;

public class SolicitacaoJaAvaliadaException extends RuntimeException {

    public SolicitacaoJaAvaliadaException(StatusSolicitacaoAjuste statusAtual) {
        super("Esta solicitação já foi avaliada (status atual: " + statusAtual + ")");
    }
}
