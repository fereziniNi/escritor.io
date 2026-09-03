package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardEventoRepository extends JpaRepository<CardEvento, Long> {

    List<CardEvento> findByCardOrderByCriadoEmAsc(Card card);

    /**
     * Pro resumo diário (pedido do cliente: "documento sobre o que foi feito no dia pelos
     * funcionarios", ver {@code relatorio.service.RelatorioDiarioService}) - eventos de TODOS os
     * cards/projetos no intervalo, sem filtro de autor (agrupamento por pessoa acontece no
     * service, não aqui).
     */
    List<CardEvento> findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(Instant inicio, Instant fim);
}
