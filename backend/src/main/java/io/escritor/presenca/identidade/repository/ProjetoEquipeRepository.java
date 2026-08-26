package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.ProjetoEquipe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjetoEquipeRepository extends JpaRepository<ProjetoEquipe, Long> {

    boolean existsByProjetoAndEquipe(Projeto projeto, Equipe equipe);
}
