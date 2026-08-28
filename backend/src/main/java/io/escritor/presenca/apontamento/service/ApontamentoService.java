package io.escritor.presenca.apontamento.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.apontamento.web.ApontamentoResponse;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

    /**
     * Só o próprio autor encerra o próprio timer - {@code encerrar()} (S4.1) já garante que um
     * apontamento fechado não pode ser fechado de novo (`ApontamentoJaEncerradoException`), então
     * esta camada só precisa checar dono e delegar.
     */
    public ApontamentoResponse parar(Long apontamentoId, Usuario usuario) {
        Apontamento apontamento = apontamentoRepository
                .findById(apontamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Apontamento não encontrado: " + apontamentoId));

        if (!apontamento.getUsuario().getId().equals(usuario.getId())) {
            throw new ApontamentoDeOutroUsuarioException();
        }

        apontamento.encerrar(Instant.now(clock));
        Apontamento salvo = apontamentoRepository.save(apontamento);

        return ApontamentoResponse.de(salvo);
    }

    /**
     * PRD: lançamento manual aceita `inicio`+`fim` (minutos calculado) OU `minutos` direto (pra
     * quem só sabe "trabalhei 2h", sem hora exata). As duas fontes juntas são ambíguas de
     * propósito - se o cliente mandar as duas, não dá pra saber qual é a verdade, então rejeita
     * em vez de escolher uma silenciosamente. Quando só `minutos` vem, sintetiza um intervalo
     * terminando agora (`fim = agora`, `inicio = agora − minutos`) só pra satisfazer o schema
     * (`inicio`/`fim` não nulos quando fechado) - o registro em si já nasce fechado, nunca um
     * timer.
     */
    public ApontamentoResponse criarManual(Long cardId, Instant inicio, Instant fim, Integer minutos, String descricao, Usuario usuario) {
        // Validação de forma pura primeiro, sem tocar o banco: não depende de o card existir.
        boolean temMinutos = minutos != null;
        boolean temIntervalo = inicio != null && fim != null;
        if (temMinutos && (inicio != null || fim != null)) {
            throw new LancamentoManualInvalidoException(
                    "Informe minutos OU início/fim pro lançamento manual, não os dois - fica ambíguo qual é a fonte da verdade");
        }
        if (!temMinutos && !temIntervalo) {
            throw new LancamentoManualInvalidoException("Informe minutos, ou início e fim juntos, pra registrar um lançamento manual");
        }

        Card card = cardRepository.findById(cardId).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));

        Apontamento novo;
        if (temMinutos) {
            Instant agora = Instant.now(clock);
            novo = new Apontamento(usuario, card, agora.minus(minutos, ChronoUnit.MINUTES), agora, descricao, OrigemApontamento.MANUAL);
        } else {
            novo = new Apontamento(usuario, card, inicio, fim, descricao, OrigemApontamento.MANUAL);
        }

        Apontamento salvo = apontamentoRepository.save(novo);
        return ApontamentoResponse.de(salvo);
    }
}
