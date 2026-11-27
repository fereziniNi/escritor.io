package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CardRepository extends JpaRepository<Card, Long> {

    Optional<Card> findFirstByColunaOrderByPosicaoDesc(Coluna coluna);

    List<Card> findByColunaOrderByPosicaoAsc(Coluna coluna);

    /** "Minhas tarefas": cards em que a pessoa é a responsável, em qualquer projeto. */
    List<Card> findByResponsavelAndArquivadoFalse(Usuario responsavel);

    /** "O que fez" (Relatórios/Estatísticas) - tarefas concluídas por uma pessoa num período,
     * mais recente primeiro. Só {@code concluidoEm} importa aqui (não {@code criadoEm}) - uma
     * tarefa criada antes do período mas concluída dentro dele conta. */
    @Query("""
            select c from Card c join c.coluna col join col.projeto p
            where c.responsavel = :responsavel
              and c.concluidoEm >= :inicio and c.concluidoEm < :fim
              and p.pessoalDe is null
            order by c.concluidoEm desc
            """)
    List<Card> findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(
            @Param("responsavel") Usuario responsavel, @Param("inicio") Instant inicio, @Param("fim") Instant fim);

    /** Mesmo filtro acima, só a contagem - usado no ranking de equipe (uma pessoa por vez, sem
     * precisar trazer os cards inteiros de todo mundo pra só contar). Cards de projeto pessoal
     * ficam de fora (não vazam pro relatório diário nem pras Estatísticas). */
    @Query("""
            select count(c) from Card c join c.coluna col join col.projeto p
            where c.responsavel = :responsavel
              and c.concluidoEm >= :inicio and c.concluidoEm < :fim
              and p.pessoalDe is null
            """)
    long countByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThan(
            @Param("responsavel") Usuario responsavel, @Param("inicio") Instant inicio, @Param("fim") Instant fim);
}
