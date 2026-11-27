package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.time.Instant;

/** Linha da lista do catálogo (sem o conteúdo dos arquivos). */
public record SkillResumoResponse(String slug, String nome, String descricao, CategoriaSkill categoria,
        boolean oficial, boolean arquivada, int versaoVigente, boolean propostaPendente, Instant atualizadaEm) {

    public static SkillResumoResponse de(Skill s, boolean propostaPendente) {
        SkillVersao v = s.getVersaoVigente();
        Instant atualizadaEm = v.getDecididaEm() != null ? v.getDecididaEm() : v.getCriadaEm();
        return new SkillResumoResponse(s.getSlug(), v.getNome(), v.getDescricao(), v.getCategoria(), s.isOficial(),
                s.isArquivada(), v.getNumero(), propostaPendente, atualizadaEm);
    }
}
