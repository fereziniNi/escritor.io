package io.escritor.presenca.chat.repository;

import io.escritor.presenca.chat.domain.Conversa;
import io.escritor.presenca.chat.domain.TipoConversa;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversaRepository extends JpaRepository<Conversa, Long> {

    /** Assume uma única linha de cada tipo "fixo" (só {@code GERAL} hoje) - garantido pela
     * migração (uma linha só) e por nunca criarmos outra pelo código. */
    Optional<Conversa> findByTipo(TipoConversa tipo);
}
