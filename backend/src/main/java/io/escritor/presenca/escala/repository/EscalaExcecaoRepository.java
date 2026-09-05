package io.escritor.presenca.escala.repository;

import io.escritor.presenca.escala.domain.EscalaExcecao;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EscalaExcecaoRepository extends JpaRepository<EscalaExcecao, Long> {

    List<EscalaExcecao> findByUsuarioAndDataBetween(Usuario usuario, LocalDate inicio, LocalDate fim);

    Optional<EscalaExcecao> findByUsuarioAndData(Usuario usuario, LocalDate data);

    Optional<EscalaExcecao> findByIdAndUsuario(Long id, Usuario usuario);
}
