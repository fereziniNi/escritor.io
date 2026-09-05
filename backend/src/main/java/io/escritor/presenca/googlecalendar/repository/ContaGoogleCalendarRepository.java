package io.escritor.presenca.googlecalendar.repository;

import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContaGoogleCalendarRepository extends JpaRepository<ContaGoogleCalendar, Long> {

    Optional<ContaGoogleCalendar> findByUsuario(Usuario usuario);
}
