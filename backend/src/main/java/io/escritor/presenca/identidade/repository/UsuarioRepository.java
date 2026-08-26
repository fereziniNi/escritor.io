package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
}
