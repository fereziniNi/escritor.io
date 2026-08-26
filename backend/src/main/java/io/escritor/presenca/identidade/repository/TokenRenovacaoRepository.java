package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.TokenRenovacao;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRenovacaoRepository extends JpaRepository<TokenRenovacao, Long> {

    Optional<TokenRenovacao> findByTokenHash(String tokenHash);

    List<TokenRenovacao> findByUsuarioAndUsadoEmIsNull(Usuario usuario);
}
