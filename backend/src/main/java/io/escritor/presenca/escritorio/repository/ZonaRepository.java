package io.escritor.presenca.escritorio.repository;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.Zona;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ZonaRepository extends JpaRepository<Zona, Long> {

    List<Zona> findByMapa(Mapa mapa);
}
