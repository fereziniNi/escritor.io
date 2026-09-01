package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import io.escritor.presenca.identidade.web.ProjetoResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ProjetoService {

    private final ProjetoRepository projetoRepository;

    public ProjetoService(ProjetoRepository projetoRepository) {
        this.projetoRepository = projetoRepository;
    }

    public ProjetoResponse criar(CriarProjetoRequest request) {
        Projeto projeto = projetoRepository.save(new Projeto(
                request.nome(), request.cliente(), request.status(), request.inicio(), request.fimPrevisto()));
        return ProjetoResponse.de(projeto);
    }

    public List<ProjetoResponse> listar() {
        return projetoRepository.findAll().stream().map(ProjetoResponse::de).toList();
    }
}
