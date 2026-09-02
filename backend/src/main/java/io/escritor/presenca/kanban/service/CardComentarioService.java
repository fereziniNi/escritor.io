package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardComentario;
import io.escritor.presenca.kanban.repository.CardComentarioRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.web.CardComentarioResponse;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Comentar exige acesso ao projeto do card (PRD/S3.15) - diferente de criar/mover card
 * (S3.6/S3.8), que são simplificações conhecidas abertas a qualquer autenticado. Reaproveita
 * {@link ProjetoService#usuarioPodeVer}, a mesma regra de visibilidade de {@code GET
 * /projetos/{id}}.
 */
@Service
public class CardComentarioService {

    private final CardRepository cardRepository;
    private final CardComentarioRepository cardComentarioRepository;
    private final ProjetoService projetoService;

    public CardComentarioService(
            CardRepository cardRepository, CardComentarioRepository cardComentarioRepository, ProjetoService projetoService) {
        this.cardRepository = cardRepository;
        this.cardComentarioRepository = cardComentarioRepository;
        this.projetoService = projetoService;
    }

    public CardComentarioResponse criar(Long cardId, String texto, Usuario autor) {
        Card card = buscarCard(cardId);
        verificarAcesso(card, autor);

        CardComentario salvo = cardComentarioRepository.save(new CardComentario(card, texto, autor));
        return CardComentarioResponse.de(salvo);
    }

    public List<CardComentarioResponse> listar(Long cardId, Usuario usuario) {
        Card card = buscarCard(cardId);
        verificarAcesso(card, usuario);

        return cardComentarioRepository.findByCardOrderByCriadoEmAsc(card).stream()
                .map(CardComentarioResponse::de)
                .toList();
    }

    private void verificarAcesso(Card card, Usuario usuario) {
        Long projetoId = card.getColuna().getProjeto().getId();
        if (!projetoService.usuarioPodeVer(projetoId, usuario)) {
            throw new AcessoNegadoException("Usuário não tem acesso ao projeto deste card");
        }
    }

    private Card buscarCard(Long id) {
        return cardRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + id));
    }
}
