package io.escritor.presenca.happyhour.web;

import io.escritor.presenca.happyhour.domain.AtividadeHappyHour;
import java.time.Instant;

public record AtividadeResponse(Long id, String descricao, String sugeridaPorNome, Instant criadaEm, Instant sorteadaEm) {

    public static AtividadeResponse de(AtividadeHappyHour atividade) {
        return new AtividadeResponse(
                atividade.getId(),
                atividade.getDescricao(),
                atividade.getSugeridaPor().getNome(),
                atividade.getCriadaEm(),
                atividade.getSorteadaEm());
    }
}
