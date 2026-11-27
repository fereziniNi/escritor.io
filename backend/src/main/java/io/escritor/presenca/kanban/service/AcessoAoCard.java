package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.kanban.domain.Card;
import org.springframework.stereotype.Component;

/**
 * Regra de acesso para AGIR sobre um card específico (mudar estado, mover, cronômetro): quem vê o
 * projeto do card (membro, ou ADMIN) OU quem é o responsável por ele. Quem recebe uma tarefa deve
 * poder trabalhar nela mesmo sem ser membro do projeto. Não vale para o resto (detalhe do projeto,
 * listas, comentários, eventos, membros, editar/excluir card), que continua só por vínculo.
 */
@Component
public class AcessoAoCard {

    private final ProjetoService projetoService;

    public AcessoAoCard(ProjetoService projetoService) {
        this.projetoService = projetoService;
    }

    public boolean podeAgir(Card card, Usuario usuario) {
        if (card.getResponsavel() != null && card.getResponsavel().getId().equals(usuario.getId())) {
            return true;
        }
        return projetoService.usuarioPodeVer(card.getColuna().getProjeto().getId(), usuario);
    }
}
