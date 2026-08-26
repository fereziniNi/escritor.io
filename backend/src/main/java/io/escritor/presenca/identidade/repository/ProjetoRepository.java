package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjetoRepository extends JpaRepository<Projeto, Long> {
}
