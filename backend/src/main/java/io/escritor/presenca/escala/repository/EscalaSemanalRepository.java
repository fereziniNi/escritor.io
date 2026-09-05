package io.escritor.presenca.escala.repository;

import io.escritor.presenca.escala.domain.EscalaSemanal;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EscalaSemanalRepository extends JpaRepository<EscalaSemanal, Long> {

    List<EscalaSemanal> findByUsuario(Usuario usuario);

    void deleteByUsuario(Usuario usuario);
}
