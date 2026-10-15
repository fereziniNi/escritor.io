package io.escritor.presenca.ponto.web;

/** Uma linha do fechamento mensal - ver `FechamentoMesService` pras regras de cada campo. */
public record FechamentoMesPessoaResponse(
        Long usuarioId,
        String nome,
        int cargaDiariaMinutos,
        int diasTrabalhados,
        long minutosTrabalhados,
        long saldoMinutos,
        int diasUteisSemMarcacao,
        int diasInconsistentes) {
}
