package io.escritor.presenca.apontamento.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.apontamento.web.ApontamentoResponse;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
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
    private final MembroEquipeRepository membroEquipeRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public ApontamentoService(
            ApontamentoRepository apontamentoRepository,
            CardRepository cardRepository,
            MembroEquipeRepository membroEquipeRepository,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.apontamentoRepository = apontamentoRepository;
        this.cardRepository = cardRepository;
        this.membroEquipeRepository = membroEquipeRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    /**
     * Instant.now() costuma ter precisão de microssegundos/nanossegundos, mas o JS Date do
     * frontend só tem milissegundos - achado ao editar um apontamento inline num browser real
     * (S4.7): reenviar um `fim` calculado a partir de um `inicio` reparseado pelo JS perdia os
     * sub-milissegundos originais, fazendo `Duration.toMinutes()` truncar 1 minuto a menos.
     * Truncar aqui, na origem de todo `inicio`/`fim` gerado pelo servidor, garante que qualquer
     * timestamp que sai em JSON sempre volta idêntico depois de um round-trip por um cliente que
     * só entende milissegundos.
     */
    private Instant agora() {
        return Instant.now(clock).truncatedTo(ChronoUnit.MILLIS);
    }

    /**
     * PRD: "no máximo um timer aberto por usuário; iniciar um novo encerra o anterior" - o timer
     * anterior (se existir, em qualquer card) é encerrado com o mesmo instante em que o novo
     * começa, antes do novo ser criado, senão o índice único parcial de S4.1
     * (`uk_apontamento_timer_aberto_por_usuario`) rejeitaria o INSERT.
     */
    public ApontamentoResponse iniciarTimer(Long cardId, Usuario usuario) {
        Card card = cardRepository.findById(cardId).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        Instant agora = agora();

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

        apontamento.encerrar(agora());
        Apontamento salvo = apontamentoRepository.save(apontamento);

        return ApontamentoResponse.de(salvo);
    }

    /**
     * PATCH parcial (S4.6) - reusa o mesmo check de dono de {@link #parar}, delega o merge pro
     * domínio ({@link Apontamento#editar}) e recalcula `minutos` só de lá, nunca aqui.
     */
    public ApontamentoResponse editar(Long apontamentoId, Instant inicio, Instant fim, String descricao, Usuario usuario) {
        Apontamento apontamento = apontamentoRepository
                .findById(apontamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Apontamento não encontrado: " + apontamentoId));

        if (!apontamento.getUsuario().getId().equals(usuario.getId())) {
            throw new ApontamentoDeOutroUsuarioException();
        }

        apontamento.editar(inicio, fim, descricao);
        Apontamento salvo = apontamentoRepository.save(apontamento);

        return ApontamentoResponse.de(salvo);
    }

    /**
     * Exclusão de verdade (S4.6) - diferente de {@code RegistroPonto} (E1), apontamento é dado de
     * gestão e não precisa de rastro de quem apagou o quê.
     */
    public void excluir(Long apontamentoId, Usuario usuario) {
        Apontamento apontamento = apontamentoRepository
                .findById(apontamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Apontamento não encontrado: " + apontamentoId));

        if (!apontamento.getUsuario().getId().equals(usuario.getId())) {
            throw new ApontamentoDeOutroUsuarioException();
        }

        apontamentoRepository.delete(apontamento);
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
            Instant agora = agora();
            novo = new Apontamento(usuario, card, agora.minus(minutos, ChronoUnit.MINUTES), agora, descricao, OrigemApontamento.MANUAL);
        } else {
            novo = new Apontamento(usuario, card, inicio, fim, descricao, OrigemApontamento.MANUAL);
        }

        Apontamento salvo = apontamentoRepository.save(novo);
        return ApontamentoResponse.de(salvo);
    }

    /**
     * Sem checagem de dono aqui de propósito - a lista é do card (podem ser vários usuários
     * apontando tempo no mesmo card), não de um usuário; dono só importa pra editar/excluir um
     * apontamento específico ({@link #editar}/{@link #excluir}), mesma simplificação de acesso ao
     * card já usada em {@link #iniciarTimer}/{@link #criarManual}.
     */
    public List<ApontamentoResponse> listarPorCard(Long cardId) {
        Card card = cardRepository.findById(cardId).orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        return apontamentoRepository.findByCardOrderByInicioDesc(card).stream().map(ApontamentoResponse::de).toList();
    }

    /**
     * Base mínima pro relatório completo (E4) - sem agregação por projeto ainda. Regra de
     * visibilidade (única do épico a diferenciar por papel dentro do serviço, não só via
     * `@PreAuthorize` de endpoint): colaborador só vê os próprios; gestor vê qualquer usuário
     * membro de uma equipe que ele lidera (`PapelNaEquipe.LIDER`); admin vê todo mundo, sem
     * checar equipe. `usuarioIdFiltro` nulo, ou igual ao do próprio requisitante, é sempre "eu
     * mesmo" e nunca precisa tocar `UsuarioRepository`/`MembroEquipeRepository`.
     */
    public List<ApontamentoResponse> listarPorUsuarioEPeriodo(Long usuarioIdFiltro, Instant inicio, Instant fim, Usuario usuarioAutenticado) {
        Usuario usuarioAlvo;
        if (usuarioIdFiltro == null || usuarioIdFiltro.equals(usuarioAutenticado.getId())) {
            usuarioAlvo = usuarioAutenticado;
        } else {
            usuarioAlvo = usuarioRepository
                    .findById(usuarioIdFiltro)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + usuarioIdFiltro));

            if (usuarioAutenticado.getPapel() != Papel.ADMIN && !podeVerApontamentosDe(usuarioAutenticado, usuarioAlvo)) {
                throw new ApontamentoDeOutroUsuarioException();
            }
        }

        return apontamentoRepository
                .findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(usuarioAlvo, inicio, fim)
                .stream()
                .map(ApontamentoResponse::de)
                .toList();
    }

    private boolean podeVerApontamentosDe(Usuario gestor, Usuario usuarioAlvo) {
        if (gestor.getPapel() != Papel.GESTOR) {
            return false;
        }
        List<Equipe> equipesLideradas = membroEquipeRepository.findByUsuarioAndPapelNaEquipe(gestor, PapelNaEquipe.LIDER).stream()
                .map(MembroEquipe::getEquipe)
                .toList();
        return membroEquipeRepository.existsByEquipeInAndUsuario(equipesLideradas, usuarioAlvo);
    }
}
