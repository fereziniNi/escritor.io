package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.RegraVisibilidadeQuadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.ColunaComCardsResponse;
import io.escritor.presenca.kanban.web.QuadroDetalheResponse;
import io.escritor.presenca.kanban.web.QuadroResponse;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class QuadroService {

    private final QuadroRepository quadroRepository;
    private final MembroEquipeRepository membroEquipeRepository;
    private final ProjetoEquipeRepository projetoEquipeRepository;
    private final ProjetoRepository projetoRepository;
    private final EquipeRepository equipeRepository;
    private final ColunaRepository colunaRepository;
    private final CardRepository cardRepository;

    public QuadroService(
            QuadroRepository quadroRepository,
            MembroEquipeRepository membroEquipeRepository,
            ProjetoEquipeRepository projetoEquipeRepository,
            ProjetoRepository projetoRepository,
            EquipeRepository equipeRepository,
            ColunaRepository colunaRepository,
            CardRepository cardRepository) {
        this.quadroRepository = quadroRepository;
        this.membroEquipeRepository = membroEquipeRepository;
        this.projetoEquipeRepository = projetoEquipeRepository;
        this.projetoRepository = projetoRepository;
        this.equipeRepository = equipeRepository;
        this.colunaRepository = colunaRepository;
        this.cardRepository = cardRepository;
    }

    public List<QuadroResponse> listarVisiveis(Usuario usuario) {
        VisibilidadeUsuario visibilidade = calcularVisibilidade(usuario);

        return quadroRepository.findAll().stream()
                .filter(quadro -> visivel(quadro, visibilidade))
                .map(QuadroResponse::de)
                .toList();
    }

    public QuadroResponse criar(String nome, Long projetoId, Long equipeId) {
        Projeto projeto = projetoId == null ? null : buscarProjeto(projetoId);
        Equipe equipe = equipeId == null ? null : buscarEquipe(equipeId);

        Quadro novo = new Quadro(nome, projeto, equipe);
        Quadro salvo = quadroRepository.save(novo);

        return QuadroResponse.de(salvo);
    }

    /**
     * 404 (não 403) quando o quadro existe mas não é visível pro usuário - mesma filosofia de
     * "não revelar que o recurso existe" já usada em {@code SolicitacaoAjusteService}.
     */
    public QuadroDetalheResponse buscarDetalhe(Long id, Usuario usuario) {
        Quadro quadro = buscarQuadro(id);
        if (!visivel(quadro, calcularVisibilidade(usuario))) {
            throw new RecursoNaoEncontradoException("Quadro não encontrado: " + id);
        }

        List<ColunaComCardsResponse> colunas = colunaRepository.findByQuadroOrderByOrdemAsc(quadro).stream()
                .map(this::paraColunaComCards)
                .toList();

        Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
        Long equipeId = quadro.getEquipe() == null ? null : quadro.getEquipe().getId();
        return new QuadroDetalheResponse(quadro.getId(), quadro.getNome(), projetoId, equipeId, quadro.isArquivado(), colunas);
    }

    private ColunaComCardsResponse paraColunaComCards(Coluna coluna) {
        List<CardResponse> cards =
                cardRepository.findByColunaOrderByPosicaoAsc(coluna).stream().map(CardResponse::de).toList();
        return new ColunaComCardsResponse(coluna.getId(), coluna.getNome(), coluna.getOrdem(), coluna.getLimiteWip(), cards);
    }

    private VisibilidadeUsuario calcularVisibilidade(Usuario usuario) {
        List<Equipe> equipesDoUsuario =
                membroEquipeRepository.findByUsuario(usuario).stream().map(MembroEquipe::getEquipe).toList();
        Set<Long> equipeIds = equipesDoUsuario.stream().map(Equipe::getId).collect(Collectors.toSet());

        Set<Long> projetoIds = projetoEquipeRepository.findByEquipeIn(equipesDoUsuario).stream()
                .map(vinculo -> vinculo.getProjeto().getId())
                .collect(Collectors.toSet());

        return new VisibilidadeUsuario(equipeIds, projetoIds);
    }

    private boolean visivel(Quadro quadro, VisibilidadeUsuario visibilidade) {
        Long equipeId = quadro.getEquipe() == null ? null : quadro.getEquipe().getId();
        Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
        return RegraVisibilidadeQuadro.visivel(equipeId, projetoId, visibilidade.equipeIds(), visibilidade.projetoIds());
    }

    private Quadro buscarQuadro(Long id) {
        return quadroRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Quadro não encontrado: " + id));
    }

    private Projeto buscarProjeto(Long id) {
        return projetoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + id));
    }

    private Equipe buscarEquipe(Long id) {
        return equipeRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Equipe não encontrada: " + id));
    }

    private record VisibilidadeUsuario(Set<Long> equipeIds, Set<Long> projetoIds) {
    }
}
