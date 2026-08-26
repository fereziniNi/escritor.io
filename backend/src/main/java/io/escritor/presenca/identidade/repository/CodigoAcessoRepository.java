package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodigoAcessoRepository extends JpaRepository<CodigoAcesso, Long> {

    Optional<CodigoAcesso> findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(Usuario usuario);
}
