package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.kanban.domain.Etiqueta;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EtiquetaRepository extends JpaRepository<Etiqueta, Long> {

    List<Etiqueta> findByProjetoOrderByNomeAsc(Projeto projeto);
}
