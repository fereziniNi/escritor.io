package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ColunaRepository extends JpaRepository<Coluna, Long> {

    boolean existsByQuadroAndOrdem(Quadro quadro, int ordem);
}
