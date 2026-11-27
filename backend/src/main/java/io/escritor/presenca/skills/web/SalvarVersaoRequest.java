package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.CategoriaSkill;
import java.util.List;

/** Corpo de "salvar edição" de uma skill: o conteúdo completo da nova versão. */
public record SalvarVersaoRequest(String nome, String descricao, CategoriaSkill categoria, String promptUso,
        String tutorialInstalacao, String mensagem, List<ArquivoRequest> arquivos) {
}
