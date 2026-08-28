package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardEventoRepository extends JpaRepository<CardEvento, Long> {

    List<CardEvento> findByCardOrderByCriadoEmAsc(Card card);
}
