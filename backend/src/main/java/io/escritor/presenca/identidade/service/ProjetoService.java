package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.ProjetoEquipe;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import io.escritor.presenca.identidade.web.ProjetoResponse;
import io.escritor.presenca.identidade.web.VincularEquipeRequest;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ProjetoService {

    private final ProjetoRepository projetoRepository;
    private final EquipeRepository equipeRepository;
    private final ProjetoEquipeRepository projetoEquipeRepository;

    public ProjetoService(
            ProjetoRepository projetoRepository,
            EquipeRepository equipeRepository,
            ProjetoEquipeRepository projetoEquipeRepository) {
        this.projetoRepository = projetoRepository;
        this.equipeRepository = equipeRepository;
        this.projetoEquipeRepository = projetoEquipeRepository;
    }

    public ProjetoResponse criar(CriarProjetoRequest request) {
        Projeto projeto = projetoRepository.save(new Projeto(
                request.nome(), request.cliente(), request.status(), request.inicio(), request.fimPrevisto()));
        return ProjetoResponse.de(projeto);
    }

    public List<ProjetoResponse> listar() {
        return projetoRepository.findAll().stream().map(ProjetoResponse::de).toList();
    }

    public void vincularEquipe(Long projetoId, VincularEquipeRequest request) {
        Projeto projeto = projetoRepository
                .findById(projetoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado"));
        Equipe equipe = equipeRepository
                .findById(request.equipeId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Equipe não encontrada"));

        if (projetoEquipeRepository.existsByProjetoAndEquipe(projeto, equipe)) {
            return;
        }

        projetoEquipeRepository.save(new ProjetoEquipe(projeto, equipe));
    }
}
