package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.Quadro;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembroQuadroRepository extends JpaRepository<MembroQuadro, Long> {

    boolean existsByQuadroAndUsuario(Quadro quadro, Usuario usuario);

    List<MembroQuadro> findByUsuario(Usuario usuario);

    List<MembroQuadro> findByQuadro(Quadro quadro);

    boolean existsByQuadroInAndUsuario(Collection<Quadro> quadros, Usuario usuario);
}
