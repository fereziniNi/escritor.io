package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.CalculadoraPosicao;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.ws.QuadroWebSocketHandler;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class CardService {

    private final CardRepository cardRepository;
    private final ColunaRepository colunaRepository;
    private final UsuarioRepository usuarioRepository;
    private final QuadroWebSocketHandler quadroWebSocketHandler;
    private final CardEventoRepository cardEventoRepository;

    public CardService(
            CardRepository cardRepository,
            ColunaRepository colunaRepository,
            UsuarioRepository usuarioRepository,
            QuadroWebSocketHandler quadroWebSocketHandler,
            CardEventoRepository cardEventoRepository) {
        this.cardRepository = cardRepository;
        this.colunaRepository = colunaRepository;
        this.usuarioRepository = usuarioRepository;
        this.quadroWebSocketHandler = quadroWebSocketHandler;
        this.cardEventoRepository = cardEventoRepository;
    }

    public CardResponse criar(
            Long colunaId,
            String titulo,
            String descricao,
            Long responsavelId,
            LocalDate prazo,
            Integer estimativaMinutos,
            Usuario criadoPor) {
        Coluna coluna = colunaRepository
                .findById(colunaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Coluna não encontrada: " + colunaId));
        Usuario responsavel = responsavelId == null ? null : buscarUsuario(responsavelId);

        Double ultimaPosicao = cardRepository
                .findFirstByColunaOrderByPosicaoDesc(coluna)
                .map(Card::getPosicao)
                .orElse(null);
        double posicao = CalculadoraPosicao.entre(ultimaPosicao, null);

        Card novo = new Card(coluna, titulo, descricao, posicao, responsavel, prazo, estimativaMinutos, criadoPor);
        Card salvo = cardRepository.save(novo);

        // S3.17: o evento nasce aqui, dentro do mesmo serviço que cria o card - nunca é escrito
        // manualmente por outra camada (controller, evento assíncrono, etc.).
        cardEventoRepository.save(new CardEvento(salvo, criadoPor, TipoEventoCard.CRIACAO, null, coluna.getNome()));

        return CardResponse.de(salvo);
    }

    /**
     * {@code indice} é a posição 0-based desejada na coluna de destino (a lista já sem o próprio
     * card, se ele já estava lá). Nunca toca nos outros cards da coluna - só recalcula a posição
     * do card movido a partir dos vizinhos no índice pedido.
     */
    public CardResponse mover(Long cardId, Long novaColunaId, int indice, Usuario autor) {
        Card card = cardRepository
                .findById(cardId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        Coluna novaColuna = colunaRepository
                .findById(novaColunaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Coluna não encontrada: " + novaColunaId));

        List<Card> cardsDoDestino = cardRepository.findByColunaOrderByPosicaoAsc(novaColuna).stream()
                .filter(outro -> !outro.getId().equals(card.getId()))
                .toList();

        // cardsDoDestino já exclui o próprio card - reordenar dentro da mesma coluna nunca conta
        // como "ocupando mais uma vaga", só entrar numa coluna diferente que já está no limite.
        Integer limiteWip = novaColuna.getLimiteWip();
        if (limiteWip != null && cardsDoDestino.size() >= limiteWip) {
            throw new LimiteWipExcedidoException(novaColuna.getId(), limiteWip);
        }

        Double anterior = indice <= 0 ? null : cardsDoDestino.get(indice - 1).getPosicao();
        Double proxima = indice >= cardsDoDestino.size() ? null : cardsDoDestino.get(indice).getPosicao();
        double novaPosicao = CalculadoraPosicao.entre(anterior, proxima);

        Coluna colunaAnterior = card.getColuna();
        card.mover(novaColuna, novaPosicao);
        Card salvo = cardRepository.save(card);
        CardResponse response = CardResponse.de(salvo);

        // S3.17: só é "mudança de coluna" de verdade quando a coluna muda - reordenar dentro da
        // mesma coluna não gera evento (não é uma transição no fluxo do card).
        if (!colunaAnterior.getId().equals(novaColuna.getId())) {
            cardEventoRepository.save(
                    new CardEvento(salvo, autor, TipoEventoCard.MUDANCA_COLUNA, colunaAnterior.getNome(), novaColuna.getNome()));
        }

        quadroWebSocketHandler.broadcastCardMovido(novaColuna.getQuadro().getId(), response);

        return response;
    }

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
    }
}
