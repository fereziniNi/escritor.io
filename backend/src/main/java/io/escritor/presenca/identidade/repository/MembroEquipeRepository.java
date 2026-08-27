package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembroEquipeRepository extends JpaRepository<MembroEquipe, Long> {

    boolean existsByEquipeAndUsuario(Equipe equipe, Usuario usuario);

    List<MembroEquipe> findByUsuario(Usuario usuario);
}
