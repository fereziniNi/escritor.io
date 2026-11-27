package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.EstadoTarefa;
import io.escritor.presenca.kanban.domain.EstadoTarefaIndisponivelException;
import io.escritor.presenca.kanban.domain.ProjetoSemColunasException;
import io.escritor.presenca.kanban.domain.TarefaJaFinalizadaException;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.TarefaResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;

/** "Minhas tarefas": visão pessoal dos cards do usuário em todos os projetos. */
@Service
public class TarefaService {

    static final int LIMITE_FEITAS = 20;

    private final CardRepository cardRepository;
    private final ColunaRepository colunaRepository;
    private final ProjetoRepository projetoRepository;
    private final ProjetoPessoalService projetoPessoalService;
    private final CardService cardService;
    private final ProjetoService projetoService;

    public TarefaService(
            CardRepository cardRepository,
            ColunaRepository colunaRepository,
            ProjetoRepository projetoRepository,
            ProjetoPessoalService projetoPessoalService,
            CardService cardService,
            ProjetoService projetoService) {
        this.cardRepository = cardRepository;
        this.colunaRepository = colunaRepository;
        this.projetoRepository = projetoRepository;
        this.projetoPessoalService = projetoPessoalService;
        this.cardService = cardService;
        this.projetoService = projetoService;
    }

    /** Lista plana (o front agrupa por estado): por estado, prazo crescente (nulo por último) e
     * criação; FEITO por conclusão decrescente, no máximo {@value #LIMITE_FEITAS}. */
    public List<TarefaResponse> listarMinhas(Usuario usuario) {
        Map<Long, List<Coluna>> colunasPorProjeto = new HashMap<>();
        List<Linha> linhas = new ArrayList<>();
        for (Card card : cardRepository.findByResponsavelAndArquivadoFalse(usuario)) {
            Projeto projeto = card.getColuna().getProjeto();
            List<Coluna> colunas = colunasPorProjeto.computeIfAbsent(
                    projeto.getId(), id -> colunaRepository.findByProjetoOrderByOrdemAsc(projeto));
            linhas.add(new Linha(card, estadoDe(card, colunas), disponiveisDe(colunas)));
        }

        Comparator<Linha> abertas = Comparator.<Linha, LocalDate>comparing(
                        l -> l.card().getPrazo(), Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(l -> l.card().getCriadoEm(), Comparator.nullsLast(Comparator.naturalOrder()));
        Comparator<Linha> feitas = Comparator.<Linha, Instant>comparing(
                        l -> l.card().getConcluidoEm(), Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(l -> l.card().getId(), Comparator.reverseOrder());

        List<TarefaResponse> resultado = new ArrayList<>();
        for (EstadoTarefa estado : EstadoTarefa.values()) {
            Stream<Linha> doEstado = linhas.stream().filter(l -> l.estado() == estado);
            doEstado = estado == EstadoTarefa.FEITO
                    ? doEstado.sorted(feitas).limit(LIMITE_FEITAS)
                    : doEstado.sorted(abertas);
            doEstado.forEach(l -> resultado.add(paraResponse(l.card(), l.estado(), l.disponiveis())));
        }
        return resultado;
    }

    /** {@code projetoIdOuNull} nulo = tarefa pessoal (projeto pessoal criado na primeira vez). */
    public TarefaResponse criar(
            Usuario usuario, String titulo, Long projetoIdOuNull, LocalDate prazo, Integer estimativaMinutos) {
        Projeto projeto;
        if (projetoIdOuNull == null) {
            projeto = projetoPessoalService.obterOuCriar(usuario);
        } else {
            // Acesso primeiro: quem não vê o projeto recebe 404 igual ao de projeto inexistente,
            // antes de qualquer outra regra (ex.: "sem colunas") revelar que ele existe.
            if (!projetoService.usuarioPodeVer(projetoIdOuNull, usuario)) {
                throw new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoIdOuNull);
            }
            projeto = projetoRepository
                    .findById(projetoIdOuNull)
                    .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoIdOuNull));
        }
        List<Coluna> colunas = colunaRepository.findByProjetoOrderByOrdemAsc(projeto);
        if (colunas.isEmpty()) {
            throw new ProjetoSemColunasException(projeto.getId());
        }
        CardResponse criado = cardService.criar(
                colunaInicial(colunas).getId(),
                titulo == null ? null : titulo.strip(),
                null,
                usuario.getId(),
                prazo,
                estimativaMinutos,
                usuario);
        Card card = cardRepository
                .findById(criado.id())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + criado.id()));
        return paraResponse(card, estadoDe(card, colunas), disponiveisDe(colunas));
    }

    public TarefaResponse mudarEstado(Long cardId, EstadoTarefa destino, Usuario usuario) {
        Card card = cardRepository
                .findById(cardId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        // Acesso antes de qualquer outra regra (inclusive o 409): quem não vê o projeto do card
        // recebe 404, como se o card não existisse. Qualquer membro pode mudar o estado (como CardService#mover).
        if (!projetoService.usuarioPodeVer(card.getColuna().getProjeto().getId(), usuario)) {
            throw new RecursoNaoEncontradoException("Card não encontrado: " + cardId);
        }
        if (card.getConcluidoEm() != null) {
            throw new TarefaJaFinalizadaException(cardId);
        }
        List<Coluna> colunas = colunaRepository.findByProjetoOrderByOrdemAsc(card.getColuna().getProjeto());
        if (colunas.isEmpty()) {
            throw new ProjetoSemColunasException(card.getColuna().getProjeto().getId());
        }
        int indiceDaColuna = EstadoTarefa.indiceDoDestino(destino, nomesDe(colunas))
                .orElseThrow(() -> new EstadoTarefaIndisponivelException(rotuloDe(destino)));
        Coluna colunaDestino = colunas.get(indiceDaColuna);
        // "Fim da coluna": quantidade de cards que ficam lá sem contar o próprio (se já estava).
        int indice = (int) cardRepository.findByColunaOrderByPosicaoAsc(colunaDestino).stream()
                .filter(outro -> !outro.getId().equals(cardId))
                .count();
        cardService.mover(cardId, colunaDestino.getId(), indice, usuario);
        // O destino existe por construção (indiceDoDestino), então o estado devolvido é o pedido.
        return paraResponse(card, destino, disponiveisDe(colunas));
    }

    private static EstadoTarefa estadoDe(Card card, List<Coluna> colunas) {
        int posicao = 0;
        for (int i = 0; i < colunas.size(); i++) {
            if (colunas.get(i).getId().equals(card.getColuna().getId())) {
                posicao = i;
                break;
            }
        }
        return EstadoTarefa.estadoDaColuna(
                colunas.get(posicao).getNome(), posicao, colunas.size(), card.getConcluidoEm() != null);
    }

    /** Primeira coluna (por ordem) que representa A fazer; sem nenhuma (ex.: quadro só com "Fazendo"),
     * a primeira coluna. */
    private static Coluna colunaInicial(List<Coluna> colunas) {
        return EstadoTarefa.indiceDoDestino(EstadoTarefa.A_FAZER, nomesDe(colunas))
                .map(colunas::get)
                .orElse(colunas.get(0));
    }

    private static List<String> nomesDe(List<Coluna> colunas) {
        return colunas.stream().map(Coluna::getNome).toList();
    }

    private static List<EstadoTarefa> disponiveisDe(List<Coluna> colunas) {
        return EstadoTarefa.disponiveis(nomesDe(colunas));
    }

    private static String rotuloDe(EstadoTarefa estado) {
        return switch (estado) {
            case A_FAZER -> "A fazer";
            case EM_ANDAMENTO -> "Em andamento";
            case FEITO -> "Feito";
        };
    }

    private static TarefaResponse paraResponse(Card card, EstadoTarefa estado, List<EstadoTarefa> disponiveis) {
        Projeto projeto = card.getColuna().getProjeto();
        return new TarefaResponse(
                card.getId(),
                card.getTitulo(),
                projeto.getId(),
                projeto.isPessoal() ? null : projeto.getNome(),
                projeto.isPessoal(),
                estado,
                card.getPrazo(),
                card.getEstimativaMinutos(),
                card.getConcluidoEm(),
                disponiveis);
    }

    private record Linha(Card card, EstadoTarefa estado, List<EstadoTarefa> disponiveis) {}
}
