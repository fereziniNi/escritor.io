package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.SkillVersao;
import java.time.Instant;

/** Item da fila de propostas pendentes (GESTOR/ADMIN). */
public record PropostaResponse(String slug, String nomeSkill, int numero, String autorNome, Instant criadaEm,
        String mensagem) {

    public static PropostaResponse de(SkillVersao v) {
        return new PropostaResponse(v.getSkill().getSlug(), v.getNome(), v.getNumero(),
                SkillVersaoResponse.nomeAutor(v), v.getCriadaEm(), v.getMensagem());
    }
}
