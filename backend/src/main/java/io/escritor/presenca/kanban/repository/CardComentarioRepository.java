package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardComentario;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardComentarioRepository extends JpaRepository<CardComentario, Long> {

    List<CardComentario> findByCardOrderByCriadoEmAsc(Card card);
}
