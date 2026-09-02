package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroProjetoException;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.EtiquetaRepository;
import io.escritor.presenca.kanban.web.EtiquetaResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EtiquetaService {

    private final EtiquetaRepository etiquetaRepository;
    private final ProjetoRepository projetoRepository;
    private final CardRepository cardRepository;
    private final CardEtiquetaRepository cardEtiquetaRepository;

    public EtiquetaService(
            EtiquetaRepository etiquetaRepository,
            ProjetoRepository projetoRepository,
            CardRepository cardRepository,
            CardEtiquetaRepository cardEtiquetaRepository) {
        this.etiquetaRepository = etiquetaRepository;
        this.projetoRepository = projetoRepository;
        this.cardRepository = cardRepository;
        this.cardEtiquetaRepository = cardEtiquetaRepository;
    }

    public EtiquetaResponse criar(Long projetoId, String nome, String cor) {
        Projeto projeto = projetoRepository
                .findById(projetoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoId));

        Etiqueta salva = etiquetaRepository.save(new Etiqueta(projeto, nome, cor));
        return EtiquetaResponse.de(salva);
    }

    public List<EtiquetaResponse> listar(Long projetoId) {
        Projeto projeto = projetoRepository
                .findById(projetoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoId));

        return etiquetaRepository.findByProjetoOrderByNomeAsc(projeto).stream().map(EtiquetaResponse::de).toList();
    }

    /**
     * Idempotente, mesmo padrão de {@code ProjetoService.adicionarMembro}: aplicar uma etiqueta
     * que o card já tem não duplica a linha, só devolve o vínculo existente.
     */
    public EtiquetaResponse aplicar(Long cardId, Long etiquetaId) {
        Card card = buscarCard(cardId);
        Etiqueta etiqueta = buscarEtiqueta(etiquetaId);

        if (!etiqueta.getProjeto().getId().equals(card.getColuna().getProjeto().getId())) {
            throw new EtiquetaDeOutroProjetoException(etiquetaId, cardId);
        }

        if (!cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)) {
            cardEtiquetaRepository.save(new CardEtiqueta(card, etiqueta));
        }

        return EtiquetaResponse.de(etiqueta);
    }

    /**
     * Idempotente também: remover uma etiqueta que o card não tem não é erro, só não faz nada -
     * mesma semântica de DELETE já usada em outros pontos da API. {@code @Transactional} aqui não
     * é opcional: {@code deleteByCardAndEtiqueta} é um delete derivado do Spring Data, não um dos
     * métodos de {@code SimpleJpaRepository} que já vêm transacionais de fábrica - sem isso,
     * `remove()` explode com `TransactionRequiredException` fora de um `@DataJpaTest` (que abre
     * uma transação sozinho pra cada teste e mascara a ausência dela aqui).
     */
    @Transactional
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
