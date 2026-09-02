package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.ColunaResponse;
import org.springframework.stereotype.Service;

@Service
public class ColunaService {

    private final ColunaRepository colunaRepository;
    private final ProjetoRepository projetoRepository;

    public ColunaService(ColunaRepository colunaRepository, ProjetoRepository projetoRepository) {
        this.colunaRepository = colunaRepository;
        this.projetoRepository = projetoRepository;
    }

    public ColunaResponse criar(Long projetoId, String nome, int ordem, Integer limiteWip) {
        Projeto projeto = projetoRepository
                .findById(projetoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoId));

        if (colunaRepository.existsByProjetoAndOrdem(projeto, ordem)) {
            throw new OrdemColunaDuplicadaException(ordem);
        }

        Coluna nova = new Coluna(projeto, nome, ordem, limiteWip);
        Coluna salva = colunaRepository.save(nova);

        return ColunaResponse.de(salva);
    }
}
