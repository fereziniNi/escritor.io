package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cria o projeto pessoal numa transação própria (REQUIRES_NEW). Fica num bean separado de
 * {@link ProjetoPessoalService} porque o Spring só intercepta chamadas entre beans: assim uma
 * violação da unicidade (corrida na primeira tarefa) derruba só esta transação, e quem chamou
 * consegue reler o projeto vencedor sem ficar com a sua transação marcada como rollback-only.
 */
@Component
public class CriadorProjetoPessoal {

    private final ProjetoRepository projetoRepository;
    private final ColunaRepository colunaRepository;
    private final MembroProjetoRepository membroProjetoRepository;
    private final Clock clock;

    public CriadorProjetoPessoal(
            ProjetoRepository projetoRepository,
            ColunaRepository colunaRepository,
            MembroProjetoRepository membroProjetoRepository,
            Clock clock) {
        this.projetoRepository = projetoRepository;
        this.colunaRepository = colunaRepository;
        this.membroProjetoRepository = membroProjetoRepository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Projeto criar(Usuario dono) {
        Projeto projeto = projetoRepository.save(Projeto.pessoalDe(dono, LocalDate.now(clock)));
        colunaRepository.save(new Coluna(projeto, "A fazer", 0, null));
        colunaRepository.save(new Coluna(projeto, "Em andamento", 1, null));
        colunaRepository.save(new Coluna(projeto, "Feito", 2, null));
        membroProjetoRepository.save(new MembroProjeto(projeto, dono));
        return projeto;
    }
}
