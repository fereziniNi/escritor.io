package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.web.CardEventoResponse;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Só lê - quem escreve {@link io.escritor.presenca.kanban.domain.CardEvento} é
 * {@link CardService}, no mesmo método que executa a ação que o evento registra (S3.17). Ler o
 * histórico exige acesso ao quadro do card, mesma regra e mesmo 403 de
 * {@link CardComentarioService} (S3.15).
 */
@Service
public class CardEventoService {

    private final CardRepository cardRepository;
    private final CardEventoRepository cardEventoRepository;
    private final QuadroService quadroService;

    public CardEventoService(CardRepository cardRepository, CardEventoRepository cardEventoRepository, QuadroService quadroService) {
        this.cardRepository = cardRepository;
        this.cardEventoRepository = cardEventoRepository;
        this.quadroService = quadroService;
    }

    public List<CardEventoResponse> listar(Long cardId, Usuario usuario) {
        Card card = cardRepository.findById(cardId).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));

        Long quadroId = card.getColuna().getQuadro().getId();
        if (!quadroService.usuarioPodeVer(quadroId, usuario)) {
            throw new AcessoNegadoException("Usuário não tem acesso ao quadro deste card");
        }

        return cardEventoRepository.findByCardOrderByCriadoEmAsc(card).stream().map(CardEventoResponse::de).toList();
    }
}
