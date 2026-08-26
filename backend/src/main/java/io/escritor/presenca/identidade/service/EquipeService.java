package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AdicionarMembroRequest;
import io.escritor.presenca.identidade.web.CriarEquipeRequest;
import io.escritor.presenca.identidade.web.EquipeResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class EquipeService {

    private final EquipeRepository equipeRepository;
    private final UsuarioRepository usuarioRepository;
    private final MembroEquipeRepository membroEquipeRepository;

    public EquipeService(
            EquipeRepository equipeRepository,
            UsuarioRepository usuarioRepository,
            MembroEquipeRepository membroEquipeRepository) {
        this.equipeRepository = equipeRepository;
        this.usuarioRepository = usuarioRepository;
        this.membroEquipeRepository = membroEquipeRepository;
    }

    public EquipeResponse criar(CriarEquipeRequest request) {
        Equipe equipe = equipeRepository.save(new Equipe(request.nome(), request.descricao()));
        return EquipeResponse.de(equipe);
    }

    public List<EquipeResponse> listar() {
        return equipeRepository.findAll().stream().map(EquipeResponse::de).toList();
    }

    public void adicionarMembro(Long equipeId, AdicionarMembroRequest request) {
        Equipe equipe = equipeRepository
                .findById(equipeId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Equipe não encontrada"));
        Usuario usuario = usuarioRepository
                .findById(request.usuarioId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado"));

        if (membroEquipeRepository.existsByEquipeAndUsuario(equipe, usuario)) {
            return;
        }

        membroEquipeRepository.save(new MembroEquipe(equipe, usuario, request.papelNaEquipe()));
    }
}
