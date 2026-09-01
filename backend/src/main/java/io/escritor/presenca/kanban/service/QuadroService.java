package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.RegraVisibilidadeQuadro;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.MembroQuadroRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.kanban.web.AdicionarMembroQuadroRequest;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.ColunaComCardsResponse;
import io.escritor.presenca.kanban.web.EtiquetaResponse;
import io.escritor.presenca.kanban.web.MembroQuadroResponse;
import io.escritor.presenca.kanban.web.QuadroDetalheResponse;
import io.escritor.presenca.kanban.web.QuadroResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class QuadroService {

    private final QuadroRepository quadroRepository;
    private final MembroQuadroRepository membroQuadroRepository;
    private final ProjetoRepository projetoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ColunaRepository colunaRepository;
    private final CardRepository cardRepository;
    private final CardEtiquetaRepository cardEtiquetaRepository;

    public QuadroService(
            QuadroRepository quadroRepository,
            MembroQuadroRepository membroQuadroRepository,
            ProjetoRepository projetoRepository,
            UsuarioRepository usuarioRepository,
            ColunaRepository colunaRepository,
            CardRepository cardRepository,
            CardEtiquetaRepository cardEtiquetaRepository) {
        this.quadroRepository = quadroRepository;
        this.membroQuadroRepository = membroQuadroRepository;
        this.projetoRepository = projetoRepository;
        this.usuarioRepository = usuarioRepository;
        this.colunaRepository = colunaRepository;
        this.cardRepository = cardRepository;
        this.cardEtiquetaRepository = cardEtiquetaRepository;
    }

    public List<QuadroResponse> listarVisiveis(Usuario usuario) {
        Set<Long> quadroIds = quadroIdsDoUsuario(usuario);

        return quadroRepository.findAll().stream()
                .filter(quadro -> RegraVisibilidadeQuadro.visivel(quadro.getId(), quadroIds))
                .map(QuadroResponse::de)
                .toList();
    }

    /**
     * Quem cria já entra como membro (pedido do cliente: atribuição individual é o que decide
     * visibilidade agora, sem Equipe) - sem isso, quem acabou de criar o quadro não conseguiria
     * mais vê-lo depois (visibilidade de quadro nunca teve bypass de ADMIN, só de {@link
     * MembroQuadro}, e essa regra não muda aqui).
     */
    public QuadroResponse criar(String nome, Long projetoId, Usuario criador) {
        Projeto projeto = projetoId == null ? null : buscarProjeto(projetoId);

        Quadro novo = new Quadro(nome, projeto);
        Quadro salvo = quadroRepository.save(novo);
        membroQuadroRepository.save(new MembroQuadro(salvo, criador));

        return QuadroResponse.de(salvo);
    }

    /**
     * Mesma regra de {@link #buscarDetalhe}, exposta como predicado puro pra quem só precisa
     * decidir "pode ou não" sem montar o response inteiro - caso do handshake de
     * {@code /ws/quadro/{id}} (S3.11), que autoriza antes mesmo do upgrade pra WebSocket
     * acontecer. Quadro inexistente é tratado igual a "não visível" (retorna {@code false}), não
     * lança - quem decide o status HTTP é quem chama.
     */
    public boolean usuarioPodeVer(Long quadroId, Usuario usuario) {
        return RegraVisibilidadeQuadro.visivel(quadroId, quadroIdsDoUsuario(usuario));
    }

    /**
     * 404 (não 403) quando o quadro existe mas não é visível pro usuário - mesma filosofia de
     * "não revelar que o recurso existe" já usada em outros pontos do domínio de ponto (ex.:
     * {@code PontoService#estadoAtual}).
     */
    public QuadroDetalheResponse buscarDetalhe(Long id, Usuario usuario) {
        Quadro quadro = buscarQuadro(id);
        if (!RegraVisibilidadeQuadro.visivel(quadro.getId(), quadroIdsDoUsuario(usuario))) {
            throw new RecursoNaoEncontradoException("Quadro não encontrado: " + id);
        }

        List<ColunaComCardsResponse> colunas = colunaRepository.findByQuadroOrderByOrdemAsc(quadro).stream()
                .map(this::paraColunaComCards)
                .toList();
        List<MembroQuadroResponse> membros =
                membroQuadroRepository.findByQuadro(quadro).stream().map(MembroQuadroResponse::de).toList();

        Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
        return new QuadroDetalheResponse(quadro.getId(), quadro.getNome(), projetoId, quadro.isArquivado(), colunas, membros);
    }

    /**
     * Pedido do cliente: pessoas atribuídas direto ao "sistema" (quadro), sem Equipe no meio -
     * mesma idempotência de {@code EquipeService#adicionarMembro} que existia antes (adicionar
     * quem já é membro não duplica nem lança erro).
     */
    public void adicionarMembro(Long quadroId, AdicionarMembroQuadroRequest request) {
        Quadro quadro = buscarQuadro(quadroId);
        Usuario usuario = usuarioRepository
                .findById(request.usuarioId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado"));

        if (membroQuadroRepository.existsByQuadroAndUsuario(quadro, usuario)) {
            return;
        }

        membroQuadroRepository.save(new MembroQuadro(quadro, usuario));
    }

    private ColunaComCardsResponse paraColunaComCards(Coluna coluna) {
        List<CardResponse> cards = cardRepository.findByColunaOrderByPosicaoAsc(coluna).stream()
                .map(card -> CardResponse.de(card, etiquetasDoCard(card)))
                .toList();
        return new ColunaComCardsResponse(coluna.getId(), coluna.getNome(), coluna.getOrdem(), coluna.getLimiteWip(), cards);
    }

    /**
     * Um `findByCard` por card (N+1) em vez de um JOIN - mesma simplicidade explícita de
     * {@link #listarVisiveis} (PRD: até 10 usuários, escala pequena o bastante pra não precisar
     * de query complexa aqui).
     */
    private List<EtiquetaResponse> etiquetasDoCard(Card card) {
        return cardEtiquetaRepository.findByCard(card).stream()
                .map(cardEtiqueta -> EtiquetaResponse.de(cardEtiqueta.getEtiqueta()))
                .toList();
    }

    private Set<Long> quadroIdsDoUsuario(Usuario usuario) {
        return membroQuadroRepository.findByUsuario(usuario).stream()
                .map(membro -> membro.getQuadro().getId())
                .collect(Collectors.toSet());
    }

    private Quadro buscarQuadro(Long id) {
        return quadroRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Quadro não encontrado: " + id));
    }

    private Projeto buscarProjeto(Long id) {
        return projetoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + id));
    }
}
