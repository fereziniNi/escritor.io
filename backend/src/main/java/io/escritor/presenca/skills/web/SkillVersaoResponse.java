package io.escritor.presenca.skills.web;

import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.time.Instant;
import java.util.List;

/** Uma versão completa da skill, com os arquivos. Autor nulo aparece como "Sistema". */
public record SkillVersaoResponse(int numero, EstadoVersao estado, String nome, String descricao,
        CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem, Long autorId, String autorNome,
        Instant criadaEm, String decididaPorNome, Instant decididaEm, String motivoRejeicao,
        List<ArquivoResponse> arquivos) {

    public static SkillVersaoResponse de(SkillVersao v) {
        return new SkillVersaoResponse(v.getNumero(), v.getEstado(), v.getNome(), v.getDescricao(), v.getCategoria(),
                v.getPromptUso(), v.getTutorialInstalacao(), v.getMensagem(), idAutor(v), nomeAutor(v), v.getCriadaEm(),
                v.getDecididaPor() == null ? null : v.getDecididaPor().getNome(), v.getDecididaEm(),
                v.getMotivoRejeicao(), v.getArquivos().stream().map(ArquivoResponse::de).toList());
    }

    /** Id do autor; nulo para "Sistema". Permite ao front saber se a proposta pendente é da pessoa logada. */
    static Long idAutor(SkillVersao v) {
        return v.getAutor() == null ? null : v.getAutor().getId();
    }

    static String nomeAutor(SkillVersao v) {
        return v.getAutor() == null ? "Sistema" : v.getAutor().getNome();
    }
}
