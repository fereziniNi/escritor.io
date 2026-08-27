package io.escritor.presenca.ponto.web;

/**
 * Compartilhado por aprovar (parecer opcional) e rejeitar (parecer obrigatório - validado no
 * domínio, não aqui, porque a mesma regra vale se algum outro caminho futuro chamar
 * {@code SolicitacaoAjustePonto.rejeitar} diretamente).
 */
public record AvaliarSolicitacaoRequest(String parecer) {
}
