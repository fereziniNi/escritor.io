package io.escritor.presenca.skills.repository;

import io.escritor.presenca.skills.domain.Skill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Skill> findAllByOrderBySlugAsc();
}
