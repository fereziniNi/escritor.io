package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroQuadroException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.EtiquetaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.kanban.web.EtiquetaResponse;
import org.springframework.stereotype.Service;

@Service
public class EtiquetaService {

    private final EtiquetaRepository etiquetaRepository;
    private final QuadroRepository quadroRepository;
    private final CardRepository cardRepository;
    private final CardEtiquetaRepository cardEtiquetaRepository;

    public EtiquetaService(
            EtiquetaRepository etiquetaRepository,
            QuadroRepository quadroRepository,
            CardRepository cardRepository,
            CardEtiquetaRepository cardEtiquetaRepository) {
        this.etiquetaRepository = etiquetaRepository;
        this.quadroRepository = quadroRepository;
        this.cardRepository = cardRepository;
        this.cardEtiquetaRepository = cardEtiquetaRepository;
    }

    public EtiquetaResponse criar(Long quadroId, String nome, String cor) {
        Quadro quadro = quadroRepository
                .findById(quadroId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Quadro não encontrado: " + quadroId));

        Etiqueta salva = etiquetaRepository.save(new Etiqueta(quadro, nome, cor));
        return EtiquetaResponse.de(salva);
    }

    /**
     * Idempotente, mesmo padrão de {@code EquipeService.adicionarMembro} (E0): aplicar uma
     * etiqueta que o card já tem não duplica a linha, só devolve o vínculo existente.
     */
    public EtiquetaResponse aplicar(Long cardId, Long etiquetaId) {
        Card card = buscarCard(cardId);
        Etiqueta etiqueta = buscarEtiqueta(etiquetaId);

        if (!etiqueta.getQuadro().getId().equals(card.getColuna().getQuadro().getId())) {
            throw new EtiquetaDeOutroQuadroException(etiquetaId, cardId);
        }

        if (!cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)) {
            cardEtiquetaRepository.save(new CardEtiqueta(card, etiqueta));
        }

        return EtiquetaResponse.de(etiqueta);
    }

    /**
     * Idempotente também: remover uma etiqueta que o card não tem não é erro, só não faz nada -
     * mesma semântica de DELETE já usada em outros pontos da API.
     */
    public void remover(Long cardId, Long etiquetaId) {
        Card card = buscarCard(cardId);
        Etiqueta etiqueta = buscarEtiqueta(etiquetaId);

        cardEtiquetaRepository.deleteByCardAndEtiqueta(card, etiqueta);
    }

    private Card buscarCard(Long id) {
        return cardRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + id));
    }

    private Etiqueta buscarEtiqueta(Long id) {
        return etiquetaRepository
                .findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Etiqueta não encontrada: " + id));
    }
}
