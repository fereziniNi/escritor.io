package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, Long> {

    Optional<Card> findFirstByColunaOrderByPosicaoDesc(Coluna coluna);

    List<Card> findByColunaOrderByPosicaoAsc(Coluna coluna);
}
