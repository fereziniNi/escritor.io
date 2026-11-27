package io.escritor.presenca.skills;

import static org.assertj.core.api.Assertions.assertThatCode;

import io.escritor.presenca.skills.service.ImportadorSkillsOficiais;
import org.junit.jupiter.api.Test;

/**
 * Guarda do plano de conteúdo: qualquer pasta em skills-oficiais que não passe no validador
 * (slug, SKILL.md, meta.yml, limites) quebra o build, em vez de só virar log no startup.
 */
class SkillsOficiaisValidasTest {

    @Test
    void todasAsSkillsDoRepositorioPassamNoValidador() {
        ImportadorSkillsOficiais importador = new ImportadorSkillsOficiais("skills-oficiais", true, null);
        for (String slug : importador.listarSlugs()) {
            assertThatCode(() -> importador.carregar(slug)).as("skill oficial %s", slug)
                    .doesNotThrowAnyException();
        }
    }
}
