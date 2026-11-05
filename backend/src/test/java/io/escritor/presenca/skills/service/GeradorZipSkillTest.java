package io.escritor.presenca.skills.service;

import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Pedido do usuário: baixar a skill (ou todas as oficiais) em zip pronto para instalar. */
class GeradorZipSkillTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T12:00:00Z");
    private final GeradorZipSkill gerador = new GeradorZipSkill();

    private static Skill skill(String slug, List<ArquivoSkill> arquivos, String tutorial) {
        Skill skill = new Skill(slug, null, AGORA);
        SkillVersao v = new SkillVersao(skill, 1, EstadoVersao.PUBLICADA, "Nome", "Desc",
                CategoriaSkill.OUTRAS, "prompt", tutorial, "msg", null, AGORA, arquivos);
        skill.definirVigente(v);
        return skill;
    }

    private static Map<String, String> ler(byte[] zip) throws IOException {
        Map<String, String> r = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                r.put(e.getName(), new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return r;
    }

    @Test
    void zipTemPastaDoSlugComArquivosETutorial() throws IOException {
        Skill s = skill("seguranca", List.of(
                new ArquivoSkill("referencia/headers.ts", "export const x = 1;"),
                new ArquivoSkill("SKILL.md", "ação")), "Copie a pasta");

        Map<String, String> zip = ler(gerador.gerar("seguranca", s.getVersaoVigente()));

        assertThat(zip.keySet()).containsExactly("seguranca/SKILL.md", "seguranca/referencia/headers.ts",
                "seguranca/TUTORIAL.md");
        assertThat(zip.get("seguranca/SKILL.md")).isEqualTo("ação");
        assertThat(zip.get("seguranca/TUTORIAL.md")).isEqualTo("Copie a pasta");
    }

    /** Ordem String simples (maiúsculas antes de minúsculas), a mesma do COLLATE "C" do banco. */
    @Test
    void entradasSeguemOrdemSimplesDeStringComoOCollateCDoBanco() throws IOException {
        Skill s = skill("ordem", List.of(
                new ArquivoSkill("b.md", "b"),
                new ArquivoSkill("SKILL.md", "s"),
                new ArquivoSkill("A.md", "a")), "t");

        Map<String, String> zip = ler(gerador.gerar("ordem", s.getVersaoVigente()));

        assertThat(zip.keySet()).containsExactly("ordem/A.md", "ordem/SKILL.md", "ordem/b.md", "ordem/TUTORIAL.md");
    }

    @Test
    void tutorialProprioDaVersaoNaoDuplicaEntrada() throws IOException {
        Skill s = skill("seguranca", List.of(
                new ArquivoSkill("SKILL.md", "x"),
                new ArquivoSkill("TUTORIAL.md", "meu tutorial")), "gerado");

        Map<String, String> zip = ler(gerador.gerar("seguranca", s.getVersaoVigente()));

        assertThat(zip.keySet()).containsExactly("seguranca/SKILL.md", "seguranca/TUTORIAL.md");
        assertThat(zip.get("seguranca/TUTORIAL.md")).isEqualTo("meu tutorial");
    }

    @Test
    void zipDeVariasSkillsUsaVigenteDeCada() throws IOException {
        Skill a = skill("alfa", List.of(new ArquivoSkill("SKILL.md", "A")), "ta");
        Skill b = skill("beta", List.of(new ArquivoSkill("SKILL.md", "B")), "tb");

        Map<String, String> zip = ler(gerador.gerarVarias(List.of(a, b)));

        assertThat(zip.keySet()).containsExactly("alfa/SKILL.md", "alfa/TUTORIAL.md",
                "beta/SKILL.md", "beta/TUTORIAL.md");
        assertThat(zip.get("beta/SKILL.md")).isEqualTo("B");
    }
}
