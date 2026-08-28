package io.escritor.presenca.apontamento.repository;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApontamentoRepository extends JpaRepository<Apontamento, Long> {

    Optional<Apontamento> findFirstByUsuarioAndFimIsNull(Usuario usuario);

    List<Apontamento> findByCardOrderByInicioDesc(Card card);

    /**
     * `FimIsNotNull` exclui timer ainda aberto do dia - equivalente a filtrar `minutos` não nulo
     * (mesmo invariante de {@link Apontamento}: `fim` nulo = timer rodando, `minutos` só existe
     * depois de encerrado), mas espelha a linguagem do domínio em vez do campo derivado.
     */
    List<Apontamento> findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
            Usuario usuario, Instant inicioDoDia, Instant fimDoDia);
}
