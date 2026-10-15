package io.escritor.presenca.ponto.web;

import java.util.List;

/** `mes` no formato AAAA-MM; `pessoas` em ordem alfabética, só quem está ativo. */
public record FechamentoMesResponse(String mes, List<FechamentoMesPessoaResponse> pessoas) {
}
