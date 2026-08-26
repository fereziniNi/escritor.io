package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;

public record ProjetoResponse(
        Long id, String nome, String cliente, StatusProjeto status, LocalDate inicio, LocalDate fimPrevisto) {

    public static ProjetoResponse de(Projeto projeto) {
        return new ProjetoResponse(
                projeto.getId(),
                projeto.getNome(),
                projeto.getCliente(),
                projeto.getStatus(),
                projeto.getInicio(),
                projeto.getFimPrevisto());
    }
}
