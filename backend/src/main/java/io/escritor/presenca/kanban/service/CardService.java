package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.CalculadoraPosicao;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

@Service
public class CardService {

    private final CardRepository cardRepository;
    private final ColunaRepository colunaRepository;
    private final UsuarioRepository usuarioRepository;

    public CardService(CardRepository cardRepository, ColunaRepository colunaRepository, UsuarioRepository usuarioRepository) {
        this.cardRepository = cardRepository;
        this.colunaRepository = colunaRepository;
        this.usuarioRepository = usuarioRepository;
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

        return CardResponse.de(salvo);
    }

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
    }
}
