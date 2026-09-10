package io.escritor.presenca.happyhour.repository;

import io.escritor.presenca.happyhour.domain.AtividadeHappyHour;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AtividadeHappyHourRepository extends JpaRepository<AtividadeHappyHour, Long> {

    List<AtividadeHappyHour> findAllByOrderByCriadaEmAsc();

    /** No máximo uma linha por vez - garantido pelo {@code HappyHourService#sortear}, não por
     * constraint de banco. */
    Optional<AtividadeHappyHour> findBySorteadaEmIsNotNull();
}
