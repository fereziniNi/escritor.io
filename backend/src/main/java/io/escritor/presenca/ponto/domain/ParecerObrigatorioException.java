package io.escritor.presenca.ponto.domain;

public class ParecerObrigatorioException extends RuntimeException {

    public ParecerObrigatorioException() {
        super("O parecer é obrigatório para rejeitar uma solicitação de ajuste");
    }
}
