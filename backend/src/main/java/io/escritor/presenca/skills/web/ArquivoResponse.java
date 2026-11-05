package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.SkillArquivo;

/** Arquivo de uma versão de skill, como o front exibe e edita. */
public record ArquivoResponse(String caminho, String conteudo) {

    public static ArquivoResponse de(SkillArquivo a) {
        return new ArquivoResponse(a.getCaminho(), a.getConteudo());
    }
}
