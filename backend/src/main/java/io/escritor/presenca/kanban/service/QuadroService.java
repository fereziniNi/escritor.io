package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
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

    public QuadroService(
            QuadroRepository quadroRepository,
            MembroEquipeRepository membroEquipeRepository,
            ProjetoEquipeRepository projetoEquipeRepository) {
        this.quadroRepository = quadroRepository;
        this.membroEquipeRepository = membroEquipeRepository;
        this.projetoEquipeRepository = projetoEquipeRepository;
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
}
