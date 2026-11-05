package io.escritor.presenca.skills.repository;

import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SkillVersaoRepository extends JpaRepository<SkillVersao, Long> {

    List<SkillVersao> findBySkillOrderByNumeroDesc(Skill skill);

    Optional<SkillVersao> findBySkillAndNumero(Skill skill, int numero);

    Optional<SkillVersao> findFirstBySkillAndEstado(Skill skill, EstadoVersao estado);

    List<SkillVersao> findByEstadoOrderByCriadaEmAsc(EstadoVersao estado);

    @Query("select coalesce(max(v.numero), 0) + 1 from SkillVersao v where v.skill = :skill")
    int proximoNumero(@Param("skill") Skill skill);
}
