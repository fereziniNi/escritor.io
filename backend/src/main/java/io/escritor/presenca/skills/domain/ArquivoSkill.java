package io.escritor.presenca.skills.domain;

/**
 * Valor imutável de um arquivo de skill (caminho relativo + conteúdo texto), usado para trafegar
 * arquivos entre serviço, validador e gerador de zip sem expor a entidade {@link SkillArquivo}.
 */
public record ArquivoSkill(String caminho, String conteudo) {
}
