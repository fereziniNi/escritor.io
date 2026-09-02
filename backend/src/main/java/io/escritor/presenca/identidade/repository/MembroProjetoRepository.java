package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembroProjetoRepository extends JpaRepository<MembroProjeto, Long> {

    boolean existsByProjetoAndUsuario(Projeto projeto, Usuario usuario);

    List<MembroProjeto> findByUsuario(Usuario usuario);

    List<MembroProjeto> findByProjeto(Projeto projeto);

    boolean existsByProjetoInAndUsuario(Collection<Projeto> projetos, Usuario usuario);
}
