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
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.RegraVisibilidadeQuadro;
import io.escritor.presenca.kanban.repository.QuadroRepository;
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

    public QuadroService(
            QuadroRepository quadroRepository,
            MembroEquipeRepository membroEquipeRepository,
            ProjetoEquipeRepository projetoEquipeRepository,
            ProjetoRepository projetoRepository,
            EquipeRepository equipeRepository) {
        this.quadroRepository = quadroRepository;
        this.membroEquipeRepository = membroEquipeRepository;
        this.projetoEquipeRepository = projetoEquipeRepository;
        this.projetoRepository = projetoRepository;
        this.equipeRepository = equipeRepository;
    }

    public List<QuadroResponse> listarVisiveis(Usuario usuario) {
        List<Equipe> equipesDoUsuario =
                membroEquipeRepository.findByUsuario(usuario).stream().map(MembroEquipe::getEquipe).toList();
        Set<Long> equipeIdsDoUsuario = equipesDoUsuario.stream().map(Equipe::getId).collect(Collectors.toSet());

        Set<Long> projetoIdsVisiveis = projetoEquipeRepository.findByEquipeIn(equipesDoUsuario).stream()
                .map(vinculo -> vinculo.getProjeto().getId())
                .collect(Collectors.toSet());

        return quadroRepository.findAll().stream()
                .filter(quadro -> {
                    Long equipeId = quadro.getEquipe() == null ? null : quadro.getEquipe().getId();
                    Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
                    return RegraVisibilidadeQuadro.visivel(equipeId, projetoId, equipeIdsDoUsuario, projetoIdsVisiveis);
                })
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

    private Projeto buscarProjeto(Long id) {
        return projetoRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + id));
    }

    private Equipe buscarEquipe(Long id) {
        return equipeRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Equipe não encontrada: " + id));
    }
}
