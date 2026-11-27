package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;

/** Detalhe da skill: versão vigente completa e, se houver, o resumo da proposta pendente. */
public record SkillDetalheResponse(String slug, boolean oficial, boolean arquivada, SkillVersaoResponse vigente,
        VersaoResumoResponse propostaPendente) {

    public static SkillDetalheResponse de(Skill s, SkillVersao proposta) {
        return new SkillDetalheResponse(s.getSlug(), s.isOficial(), s.isArquivada(),
                SkillVersaoResponse.de(s.getVersaoVigente()),
                proposta == null ? null : VersaoResumoResponse.de(proposta));
    }
}
