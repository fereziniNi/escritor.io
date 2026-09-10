package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.CronometroJaEmAndamentoException;
import io.escritor.presenca.kanban.domain.CronometroNaoIniciadoException;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.kanban.web.CronometroAtivoResponse;
import io.escritor.presenca.kanban.web.CronometroResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: "deixe somente um contador de tempo onde a pessoa inicia, pausa e finaliza e
 * descreve o que foi feito quando finaliza a tarefa. Isso engloba a tarefa inteira" - substitui o
 * lançamento manual ({@code ApontamentoService}, removido) por um cronômetro por {@link Card}:
 * "Iniciar" abre uma {@link SessaoTrabalho}, "Pausar"/"Finalizar" fecham a aberta. Cada ação
 * também grava um {@link CardEvento} (mesmo padrão de {@code CardService#mover}, S3.17: o evento
 * nasce dentro do mesmo serviço que faz a mudança) - é isso que alimenta "o histórico dentro da
 * tarefa" pedido (o `HistoricoSecao` do front já lista `CardEvento` cronologicamente, com dia/hora
 * - não precisa de nada novo lá além dos rótulos dos 3 tipos novos).
 *
 * <p>Aberto a qualquer usuário autenticado, em qualquer card - mesma simplificação já usada por
 * {@code CardService#criar}/{@code #mover} (sem checar responsável/projeto).
 */
@Service
public class SessaoTrabalhoService {

    private final CardRepository cardRepository;
    private final SessaoTrabalhoRepository sessaoTrabalhoRepository;
    private final CardEventoRepository cardEventoRepository;
    private final Clock clock;

    public SessaoTrabalhoService(
            CardRepository cardRepository,
            SessaoTrabalhoRepository sessaoTrabalhoRepository,
            CardEventoRepository cardEventoRepository,
            Clock clock) {
        this.cardRepository = cardRepository;
        this.sessaoTrabalhoRepository = sessaoTrabalhoRepository;
        this.cardEventoRepository = cardEventoRepository;
        this.clock = clock;
    }

    @Transactional
    public CronometroResponse iniciar(Long cardId, Usuario autor) {
        Card card = buscarCard(cardId);
        if (card.getConcluidoEm() != null) {
            throw new CronometroJaEmAndamentoException("Essa tarefa já foi finalizada");
        }
        // Pedido do usuário: widget global do "cronômetro ativo" só mostra UMA tarefa - impede a
        // MESMA pessoa de ter 2 cronômetros rodando ao mesmo tempo em cards diferentes. A checagem
        // por-card logo abaixo continua necessária: ela impede duas PESSOAS DIFERENTES de iniciar
        // ao mesmo tempo no mesmo card (aberto a qualquer autenticado).
        if (sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor).isPresent()) {
            throw new CronometroJaEmAndamentoException("Você já tem um cronômetro em andamento em outra tarefa");
        }
        if (sessaoTrabalhoRepository.findByCardAndFimIsNull(card).isPresent()) {
            throw new CronometroJaEmAndamentoException("O cronômetro dessa tarefa já está em andamento");
        }

        sessaoTrabalhoRepository.save(new SessaoTrabalho(card, autor, Instant.now(clock)));
        cardEventoRepository.save(new CardEvento(card, autor, TipoEventoCard.INICIOU_TRABALHO, null, null));

        return status(card);
    }

    @Transactional
    public CronometroResponse pausar(Long cardId, Usuario autor) {
        Card card = buscarCard(cardId);
        SessaoTrabalho aberta = sessaoTrabalhoRepository
                .findByCardAndFimIsNull(card)
                .orElseThrow(() -> new CronometroNaoIniciadoException("O cronômetro dessa tarefa não está em andamento"));

        aberta.pausar(Instant.now(clock));
        sessaoTrabalhoRepository.save(aberta);
        cardEventoRepository.save(new CardEvento(card, autor, TipoEventoCard.PAUSOU_TRABALHO, null, aberta.getMinutos() + " min"));

        return status(card);
    }

    /** Finaliza mesmo sem nenhuma sessão aberta/iniciada (0 min trabalhados, só a descrição) -
     * mais tolerante do que exigir que a pessoa sempre lembre de apertar Iniciar antes. Fecha
     * qualquer sessão aberta primeiro, se houver. */
    @Transactional
    public CronometroResponse finalizar(Long cardId, String descricao, Usuario autor) {
        Card card = buscarCard(cardId);
        if (card.getConcluidoEm() != null) {
            throw new CronometroJaEmAndamentoException("Essa tarefa já foi finalizada");
        }

        sessaoTrabalhoRepository.findByCardAndFimIsNull(card).ifPresent(aberta -> {
            aberta.pausar(Instant.now(clock));
            sessaoTrabalhoRepository.save(aberta);
        });

        card.finalizar(descricao, Instant.now(clock));
        Card salvo = cardRepository.save(card);

        long totalMinutos = somarMinutosFechados(salvo);
        cardEventoRepository.save(new CardEvento(salvo, autor, TipoEventoCard.FINALIZOU_TRABALHO, totalMinutos + " min", descricao));

        return status(salvo);
    }

    @Transactional(readOnly = true)
    public CronometroResponse consultar(Long cardId) {
        return status(buscarCard(cardId));
    }

    /** Pedido do usuário: widget global (canto superior direito) da tarefa que essa pessoa está
     * com o cronômetro rodando agora, em qualquer projeto - vazio quando ninguém está rodando. */
    @Transactional(readOnly = true)
    public Optional<CronometroAtivoResponse> consultarAtivo(Usuario usuario) {
        return sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(usuario).map(aberta -> {
            Card card = aberta.getCard();
            Long projetoId = card.getColuna().getProjeto().getId();
            return new CronometroAtivoResponse(card.getId(), card.getTitulo(), projetoId, aberta.getInicio(), somarMinutosFechados(card));
        });
    }

    private CronometroResponse status(Card card) {
        Instant iniciadoEm = sessaoTrabalhoRepository.findByCardAndFimIsNull(card).map(SessaoTrabalho::getInicio).orElse(null);
        long totalMinutosFechados = somarMinutosFechados(card);
        return new CronometroResponse(card.getId(), iniciadoEm, totalMinutosFechados, card.getDescricaoConclusao(), card.getConcluidoEm());
    }

    private long somarMinutosFechados(Card card) {
        return sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card).stream()
                .map(SessaoTrabalho::getMinutos)
                .filter(minutos -> minutos != null)
                .mapToLong(Long::longValue)
                .sum();
    }

    private Card buscarCard(Long id) {
        return cardRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + id));
    }
}
