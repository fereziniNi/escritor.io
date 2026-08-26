package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.TokenRenovacao;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRenovacaoRepository extends JpaRepository<TokenRenovacao, Long> {
}
