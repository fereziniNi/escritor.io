package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.kanban.web.ColunaResponse;
import org.springframework.stereotype.Service;

@Service
public class ColunaService {

    private final ColunaRepository colunaRepository;
    private final QuadroRepository quadroRepository;

    public ColunaService(ColunaRepository colunaRepository, QuadroRepository quadroRepository) {
        this.colunaRepository = colunaRepository;
        this.quadroRepository = quadroRepository;
    }

    public ColunaResponse criar(Long quadroId, String nome, int ordem, Integer limiteWip) {
        Quadro quadro = quadroRepository
                .findById(quadroId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Quadro não encontrado: " + quadroId));

        if (colunaRepository.existsByQuadroAndOrdem(quadro, ordem)) {
            throw new OrdemColunaDuplicadaException(ordem);
        }

        Coluna nova = new Coluna(quadro, nome, ordem, limiteWip);
        Coluna salva = colunaRepository.save(nova);

        return ColunaResponse.de(salva);
    }
}
