package io.escritor.presenca.kanban.web;

import java.util.List;

public record QuadroDetalheResponse(
        Long id,
        String nome,
        Long projetoId,
        boolean arquivado,
        List<ColunaComCardsResponse> colunas,
        List<MembroQuadroResponse> membros) {
}
