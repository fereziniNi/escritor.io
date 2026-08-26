package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembroEquipeRepository extends JpaRepository<MembroEquipe, Long> {

    boolean existsByEquipeAndUsuario(Equipe equipe, Usuario usuario);
}
