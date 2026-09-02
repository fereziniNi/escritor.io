package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.kanban.domain.Coluna;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ColunaRepository extends JpaRepository<Coluna, Long> {

    boolean existsByProjetoAndOrdem(Projeto projeto, int ordem);

    List<Coluna> findByProjetoOrderByOrdemAsc(Projeto projeto);
}
