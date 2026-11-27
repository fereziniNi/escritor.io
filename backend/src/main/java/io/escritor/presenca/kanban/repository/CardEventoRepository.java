package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CardEventoRepository extends JpaRepository<CardEvento, Long> {

    List<CardEvento> findByCardOrderByCriadoEmAsc(Card card);

    /**
     * Pro resumo diário (pedido do cliente: "documento sobre o que foi feito no dia pelos
     * funcionarios", ver {@code relatorio.service.RelatorioDiarioService}) - eventos de TODOS os
     * cards/projetos no intervalo, sem filtro de autor (agrupamento por pessoa acontece no
     * service, não aqui). Eventos de cards de projeto pessoal ficam de fora (não vazam pro
     * resumo diário).
     */
    @Query("""
            select e from CardEvento e join e.card c join c.coluna col join col.projeto p
            where e.criadoEm >= :inicio and e.criadoEm < :fim
              and p.pessoalDe is null
            """)
    List<CardEvento> findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(
            @Param("inicio") Instant inicio, @Param("fim") Instant fim);
}
