package io.escritor.presenca.apontamento.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.apontamento.web.ApontamentoResponse;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;

/**
 * Iniciar timer é aberto a qualquer usuário autenticado em qualquer card, mesma simplificação
 * conhecida já usada pra criar card/aplicar etiqueta (S3.6/S3.13) - ainda não verifica acesso ao
 * quadro dono do card.
 */
@Service
public class ApontamentoService {

    private final ApontamentoRepository apontamentoRepository;
    private final CardRepository cardRepository;
    private final Clock clock;

    public ApontamentoService(ApontamentoRepository apontamentoRepository, CardRepository cardRepository, Clock clock) {
        this.apontamentoRepository = apontamentoRepository;
        this.cardRepository = cardRepository;
        this.clock = clock;
    }

    /**
     * PRD: "no máximo um timer aberto por usuário; iniciar um novo encerra o anterior" - o timer
     * anterior (se existir, em qualquer card) é encerrado com o mesmo instante em que o novo
     * começa, antes do novo ser criado, senão o índice único parcial de S4.1
     * (`uk_apontamento_timer_aberto_por_usuario`) rejeitaria o INSERT.
     */
    public ApontamentoResponse iniciarTimer(Long cardId, Usuario usuario) {
        Card card = cardRepository.findById(cardId).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        Instant agora = Instant.now(clock);

        apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario).ifPresent(timerAberto -> {
            timerAberto.encerrar(agora);
            apontamentoRepository.save(timerAberto);
        });

        Apontamento novo = new Apontamento(usuario, card, agora, null, null, OrigemApontamento.TIMER);
        Apontamento salvo = apontamentoRepository.save(novo);

        return ApontamentoResponse.de(salvo);
    }
}
