package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.RegraVisibilidadeProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AdicionarMembroProjetoRequest;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import io.escritor.presenca.identidade.web.MembroProjetoResponse;
import io.escritor.presenca.identidade.web.ProjetoDetalheResponse;
import io.escritor.presenca.identidade.web.ProjetoResponse;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.ColunaComCardsResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Pedido do cliente (via usuário): "remova essa parte de quadro, vamos trabalhar apenas com
 * projeto" - Projeto absorve por completo o que era {@code QuadroService}: colunas, cards e a
 * atribuição individual que decide quem vê o quê ({@link MembroProjeto}). Continua sem bypass de
 * ADMIN na visibilidade (nunca teve, nem quando era quadro) - por isso {@link #criar} adiciona
 * quem cria como membro, senão a própria pessoa não veria o projeto que acabou de criar.
 */
@Service
public class ProjetoService {

    private final ProjetoRepository projetoRepository;
    private final MembroProjetoRepository membroProjetoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ColunaRepository colunaRepository;
    private final CardRepository cardRepository;

    public ProjetoService(
            ProjetoRepository projetoRepository,
            MembroProjetoRepository membroProjetoRepository,
            UsuarioRepository usuarioRepository,
            ColunaRepository colunaRepository,
            CardRepository cardRepository) {
        this.projetoRepository = projetoRepository;
        this.membroProjetoRepository = membroProjetoRepository;
        this.usuarioRepository = usuarioRepository;
        this.colunaRepository = colunaRepository;
        this.cardRepository = cardRepository;
    }

    public ProjetoResponse criar(CriarProjetoRequest request, Usuario criador) {
        Projeto novo = new Projeto(request.nome(), request.cliente(), request.status(), request.inicio(), request.fimPrevisto());
        Projeto salvo = projetoRepository.save(novo);
        membroProjetoRepository.save(new MembroProjeto(salvo, criador));

        return ProjetoResponse.de(salvo);
    }

    public List<ProjetoResponse> listarVisiveis(Usuario usuario) {
        Set<Long> projetoIds = projetoIdsDoUsuario(usuario);

        return projetoRepository.findAll().stream()
                .filter(projeto -> RegraVisibilidadeProjeto.visivel(projeto.getId(), projetoIds))
                .map(ProjetoResponse::de)
                .toList();
    }

    /**
     * Mesma regra de {@link #buscarDetalhe}, exposta como predicado puro pra quem só precisa
     * decidir "pode ou não" sem montar o response inteiro - caso do handshake de
     * {@code /ws/projeto/{id}}, que autoriza antes mesmo do upgrade pra WebSocket acontecer, e de
     * {@code CardComentarioService}/{@code CardEventoService}, que checam acesso ao projeto do
     * card. Projeto inexistente é tratado igual a "não visível" (retorna {@code false}), não
     * lança - quem decide o status HTTP é quem chama.
     */
    public boolean usuarioPodeVer(Long projetoId, Usuario usuario) {
        return RegraVisibilidadeProjeto.visivel(projetoId, projetoIdsDoUsuario(usuario));
    }

    /**
     * 404 (não 403) quando o projeto existe mas não é visível pro usuário - mesma filosofia de
     * "não revelar que o recurso existe" já usada em outros pontos do domínio de ponto (ex.:
     * {@code PontoService#estadoAtual}).
     */
    public ProjetoDetalheResponse buscarDetalhe(Long id, Usuario usuario) {
        Projeto projeto = buscarProjeto(id);
        if (!RegraVisibilidadeProjeto.visivel(projeto.getId(), projetoIdsDoUsuario(usuario))) {
            throw new RecursoNaoEncontradoException("Projeto não encontrado: " + id);
        }

        List<ColunaComCardsResponse> colunas = colunaRepository.findByProjetoOrderByOrdemAsc(projeto).stream()
                .map(this::paraColunaComCards)
                .toList();
        List<MembroProjetoResponse> membros =
                membroProjetoRepository.findByProjeto(projeto).stream().map(MembroProjetoResponse::de).toList();

        return new ProjetoDetalheResponse(
                projeto.getId(),
                projeto.getNome(),
                projeto.getCliente(),
                projeto.getStatus(),
                projeto.getInicio(),
                projeto.getFimPrevisto(),
                colunas,
                membros);
    }

    /**
     * Pedido do cliente: pessoas atribuídas direto ao projeto, sem quadro/equipe no meio -
     * idempotente (adicionar quem já é membro não duplica nem lança erro), mesmo comportamento
     * de antes.
     */
    public void adicionarMembro(Long projetoId, AdicionarMembroProjetoRequest request) {
        Projeto projeto = buscarProjeto(projetoId);
        Usuario usuario = usuarioRepository
                .findById(request.usuarioId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado"));

        if (membroProjetoRepository.existsByProjetoAndUsuario(projeto, usuario)) {
            return;
        }

        membroProjetoRepository.save(new MembroProjeto(projeto, usuario));
    }

    private ColunaComCardsResponse paraColunaComCards(Coluna coluna) {
        List<CardResponse> cards = cardRepository.findByColunaOrderByPosicaoAsc(coluna).stream()
                .map(CardResponse::de)
                .toList();
        return new ColunaComCardsResponse(coluna.getId(), coluna.getNome(), coluna.getOrdem(), coluna.getLimiteWip(), cards);
    }

    private Set<Long> projetoIdsDoUsuario(Usuario usuario) {
        return membroProjetoRepository.findByUsuario(usuario).stream()
                .map(membro -> membro.getProjeto().getId())
                .collect(Collectors.toSet());
    }

    private Projeto buscarProjeto(Long id) {
        return projetoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + id));
    }
}
