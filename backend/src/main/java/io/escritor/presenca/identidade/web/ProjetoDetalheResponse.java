package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.kanban.web.ColunaComCardsResponse;
import java.time.LocalDate;
import java.util.List;

public record ProjetoDetalheResponse(
        Long id,
        String nome,
        String cliente,
        StatusProjeto status,
        LocalDate inicio,
        LocalDate fimPrevisto,
        List<ColunaComCardsResponse> colunas,
        List<MembroProjetoResponse> membros) {
}
