package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.ColunaResponse;
import org.springframework.stereotype.Service;

@Service
public class ColunaService {

    private final ColunaRepository colunaRepository;
    private final ProjetoRepository projetoRepository;
    private final ProjetoService projetoService;

    public ColunaService(ColunaRepository colunaRepository, ProjetoRepository projetoRepository, ProjetoService projetoService) {
        this.colunaRepository = colunaRepository;
        this.projetoRepository = projetoRepository;
        this.projetoService = projetoService;
    }

    /**
     * Auditoria de segurança (VULN-02, HIGH): antes desta correção, qualquer autenticado criava
     * coluna em QUALQUER projeto do sistema, mesmo um sem nenhum vínculo - {@code solicitante}
     * (novo parâmetro) é checado contra {@link ProjetoService#usuarioPodeVer}, a mesma regra de
     * visibilidade de {@code GET /projetos/{id}} - 403, não 404, mesma filosofia de {@code
     * CardComentarioService} (o projeto já é referenciado direto por id, esconder a existência não
     * é o objetivo aqui).
     */
    public ColunaResponse criar(Long projetoId, String nome, int ordem, Integer limiteWip, Usuario solicitante) {
        Projeto projeto = projetoRepository
                .findById(projetoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoId));
        if (!projetoService.usuarioPodeVer(projeto.getId(), solicitante)) {
            throw new AcessoNegadoException("Usuário não tem acesso a este projeto");
        }

        if (colunaRepository.existsByProjetoAndOrdem(projeto, ordem)) {
            throw new OrdemColunaDuplicadaException(ordem);
        }

        Coluna nova = new Coluna(projeto, nome, ordem, limiteWip);
        Coluna salva = colunaRepository.save(nova);

        return ColunaResponse.de(salva);
    }
}
