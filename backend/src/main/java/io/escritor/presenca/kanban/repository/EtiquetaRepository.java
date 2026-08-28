package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.Quadro;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EtiquetaRepository extends JpaRepository<Etiqueta, Long> {

    List<Etiqueta> findByQuadroOrderByNomeAsc(Quadro quadro);
}
