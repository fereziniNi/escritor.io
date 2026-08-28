package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Etiqueta;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardEtiquetaRepository extends JpaRepository<CardEtiqueta, Long> {

    boolean existsByCardAndEtiqueta(Card card, Etiqueta etiqueta);

    void deleteByCardAndEtiqueta(Card card, Etiqueta etiqueta);

    List<CardEtiqueta> findByCard(Card card);
}
