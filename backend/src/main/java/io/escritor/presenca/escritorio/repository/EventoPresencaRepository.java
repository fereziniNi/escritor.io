package io.escritor.presenca.escritorio.repository;

import io.escritor.presenca.escritorio.domain.EventoPresenca;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventoPresencaRepository extends JpaRepository<EventoPresenca, Long> {

    Optional<EventoPresenca> findFirstByUsuarioIdAndZonaIdAndSaiuEmIsNull(Long usuarioId, Long zonaId);

    List<EventoPresenca> findByUsuarioId(Long usuarioId);
}
