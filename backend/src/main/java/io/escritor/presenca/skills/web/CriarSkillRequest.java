package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.CategoriaSkill;
import java.util.List;

/** Corpo de "criar skill": o slug (imutável) mais o conteúdo da versão 1. */
public record CriarSkillRequest(String slug, String nome, String descricao, CategoriaSkill categoria,
        String promptUso, String tutorialInstalacao, String mensagem, List<ArquivoRequest> arquivos) {
}
