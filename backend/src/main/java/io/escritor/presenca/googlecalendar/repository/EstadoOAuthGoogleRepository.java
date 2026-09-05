package io.escritor.presenca.googlecalendar.repository;

import io.escritor.presenca.googlecalendar.domain.EstadoOAuthGoogle;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstadoOAuthGoogleRepository extends JpaRepository<EstadoOAuthGoogle, String> {
}
