package io.escritor.presenca.escritorio.repository;

import io.escritor.presenca.escritorio.domain.Mapa;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapaRepository extends JpaRepository<Mapa, Long> {

    Optional<Mapa> findFirstByAtivoTrue();
}
