package io.escritor.presenca.skills.repository;

import io.escritor.presenca.skills.domain.Skill;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findBySlug(String slug);

    /**
     * Trava a linha da skill até o fim da transação: serializa os comandos (salvar, aprovar,
     * rejeitar...) da mesma skill, para o número da versão e o estado da proposta não correrem.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Skill s where s.slug = :slug")
    Optional<Skill> findComLockBySlug(@org.springframework.data.repository.query.Param("slug") String slug);

    boolean existsBySlug(String slug);

    List<Skill> findAllByOrderBySlugAsc();
}
