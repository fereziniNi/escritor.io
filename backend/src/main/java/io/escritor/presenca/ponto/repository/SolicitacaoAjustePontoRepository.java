package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SolicitacaoAjustePontoRepository extends JpaRepository<SolicitacaoAjustePonto, Long> {

    List<SolicitacaoAjustePonto> findByStatusOrderByCriadoEmAsc(StatusSolicitacaoAjuste status);
}
