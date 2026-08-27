package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistroPontoRepository extends JpaRepository<RegistroPonto, Long> {

    Optional<RegistroPonto> findFirstByUsuarioOrderByCriadoEmDesc(Usuario usuario);

    List<RegistroPonto> findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(Usuario usuario, Instant desde);
}
