package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
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
 * Comentar exige acesso ao quadro do card (PRD/S3.15) - diferente de criar/mover card e
 * aplicar/remover etiqueta (S3.6/S3.8/S3.13), que são simplificações conhecidas abertas a
 * qualquer autenticado. Reaproveita {@link QuadroService#usuarioPodeVer}, a mesma regra de
 * visibilidade de {@code GET /quadros/{id}} (S3.2/S3.7/S3.11).
 */
@Service
public class CardComentarioService {

    private final CardRepository cardRepository;
    private final CardComentarioRepository cardComentarioRepository;
    private final QuadroService quadroService;

    public CardComentarioService(
            CardRepository cardRepository, CardComentarioRepository cardComentarioRepository, QuadroService quadroService) {
        this.cardRepository = cardRepository;
        this.cardComentarioRepository = cardComentarioRepository;
        this.quadroService = quadroService;
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
        Long quadroId = card.getColuna().getQuadro().getId();
        if (!quadroService.usuarioPodeVer(quadroId, usuario)) {
            throw new AcessoNegadoException("Usuário não tem acesso ao quadro deste card");
        }
    }

    private Card buscarCard(Long id) {
        return cardRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + id));
    }
}
