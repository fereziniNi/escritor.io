package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, Long> {

    Optional<Card> findFirstByColunaOrderByPosicaoDesc(Coluna coluna);

    List<Card> findByColunaOrderByPosicaoAsc(Coluna coluna);

    /** "O que fez" (Relatórios/Estatísticas) - tarefas concluídas por uma pessoa num período,
     * mais recente primeiro. Só {@code concluidoEm} importa aqui (não {@code criadoEm}) - uma
     * tarefa criada antes do período mas concluída dentro dele conta. */
    List<Card> findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(
            Usuario responsavel, Instant inicio, Instant fim);

    /** Mesmo filtro acima, só a contagem - usado no ranking de equipe (uma pessoa por vez, sem
     * precisar trazer os cards inteiros de todo mundo pra só contar). */
    long countByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThan(Usuario responsavel, Instant inicio, Instant fim);
}
