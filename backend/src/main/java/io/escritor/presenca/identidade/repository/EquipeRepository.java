package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipeRepository extends JpaRepository<Equipe, Long> {
}
