package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.time.Instant;

/** Versão sem arquivos, prompt e tutorial: serve ao histórico e à proposta pendente. */
public record VersaoResumoResponse(int numero, EstadoVersao estado, String nome, String descricao,
        CategoriaSkill categoria, String mensagem, Long autorId, String autorNome, Instant criadaEm, String decididaPorNome,
        Instant decididaEm, String motivoRejeicao) {

    public static VersaoResumoResponse de(SkillVersao v) {
        return new VersaoResumoResponse(v.getNumero(), v.getEstado(), v.getNome(), v.getDescricao(), v.getCategoria(),
                v.getMensagem(), SkillVersaoResponse.idAutor(v), SkillVersaoResponse.nomeAutor(v), v.getCriadaEm(),
                v.getDecididaPor() == null ? null : v.getDecididaPor().getNome(), v.getDecididaEm(),
                v.getMotivoRejeicao());
    }
}
