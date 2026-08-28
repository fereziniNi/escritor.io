package io.escritor.presenca.apontamento.repository;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApontamentoRepository extends JpaRepository<Apontamento, Long> {

    Optional<Apontamento> findFirstByUsuarioAndFimIsNull(Usuario usuario);
}
