package io.escritor.presenca.skills.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ValidadorPacoteSkillTest {

    private static final String SKILL_MD = "---\nname: seguranca\ndescription: Boas praticas\n---\n# Corpo\n";

    private static ArquivoSkill skill() {
        return new ArquivoSkill("SKILL.md", SKILL_MD);
    }

    private static void invalido(String slug, List<ArquivoSkill> arquivos, String trecho) {
        assertThatThrownBy(() -> ValidadorPacoteSkill.validarArquivos(slug, arquivos))
                .isInstanceOf(SkillInvalidaException.class)
                .hasMessageContaining(trecho);
    }

    @ParameterizedTest
    @ValueSource(strings = {"seguranca", "login-codigo-email"})
    void slugValido(String slug) {
        assertThatCode(() -> ValidadorPacoteSkill.validarSlug(slug)).doesNotThrowAnyException();
    }

    @Test
    void slugsInvalidos() {
        for (String s : new String[] {"ab", "Login", "login--x", "-x", "a".repeat(65), null}) {
            assertThatThrownBy(() -> ValidadorPacoteSkill.validarSlug(s)).isInstanceOf(SkillInvalidaException.class);
        }
    }

    @Test
    void semSkillMd() {
        invalido("seguranca", List.of(new ArquivoSkill("outro.md", "x")), "SKILL.md");
    }

    @Test
    void frontmatterAusente() {
        invalido("seguranca", List.of(new ArquivoSkill("SKILL.md", "# so corpo")), "frontmatter");
    }

    @Test
    void nameDiferenteDoSlug() {
        invalido("seguranca", List.of(new ArquivoSkill("SKILL.md", "---\nname: outra\ndescription: d\n---\n")), "name");
    }

    @Test
    void descriptionVazia() {
        invalido("seguranca", List.of(new ArquivoSkill("SKILL.md", "---\nname: seguranca\ndescription: \"\"\n---\n")),
                "description");
    }

    @Test
    void caminhosInvalidos() {
        for (String c : new String[] {"../x.md", "a/../../b", "/abs.md", "\\x.md", "C:/x.md", "Instalação.md",
                "a b.md", "a".repeat(201), "./x.md"}) {
            invalido("seguranca", List.of(skill(), new ArquivoSkill(c, "x")), "aminho");
        }
    }

    @Test
    void caminhoDuplicado() {
        invalido("seguranca", List.of(skill(), new ArquivoSkill("a.md", "x"), new ArquivoSkill("a.md", "y")),
                "uplicado");
    }

    @Test
    void maisDe50Arquivos() {
        List<ArquivoSkill> l = new ArrayList<>(List.of(skill()));
        for (int i = 0; i < 50; i++) {
            l.add(new ArquivoSkill("f" + i + ".md", "x"));
        }
        invalido("seguranca", l, "50");
    }

    @Test
    void arquivoMaiorQue256Kb() {
        invalido("seguranca", List.of(skill(), new ArquivoSkill("g.md", "a".repeat(262145))), "256");
    }

    @Test
    void arquivoExatamente256KbPassa() {
        assertThatCode(() -> ValidadorPacoteSkill.validarArquivos("seguranca",
                List.of(skill(), new ArquivoSkill("g.md", "a".repeat(262144))))).doesNotThrowAnyException();
    }

    @Test
    void tamanhoMedidoEmBytesUtf8() {
        // 131073 x "ã" = 262146 bytes
        invalido("seguranca", List.of(skill(), new ArquivoSkill("g.md", "ã".repeat(131073))), "256");
    }

    @Test
    void totalMaiorQue2Mb() {
        List<ArquivoSkill> l = new ArrayList<>(List.of(skill()));
        int resto = 2097153 - SKILL_MD.length();
        while (resto > 0) {
            int n = Math.min(resto, 262144);
            l.add(new ArquivoSkill("p" + l.size() + ".md", "a".repeat(n)));
            resto -= n;
        }
        invalido("seguranca", l, "2 MB");
    }

    @Test
    void pacoteValido() {
        assertThatCode(() -> ValidadorPacoteSkill.validarArquivos("seguranca",
                List.of(skill(), new ArquivoSkill("referencia/otp.service.ts", "export {}"))))
                .doesNotThrowAnyException();
    }

    @Test
    void lerFrontmatter() {
        assertThat(ValidadorPacoteSkill.lerFrontmatter(SKILL_MD))
                .containsEntry("name", "seguranca").containsEntry("description", "Boas praticas");
        assertThat(ValidadorPacoteSkill.lerFrontmatter("sem")).isEmpty();
    }

    @Test
    void yamlComTipoArbitrarioNaoConstroi() {
        invalido("seguranca", List.of(new ArquivoSkill("SKILL.md",
                "---\nname: !!java.net.URL \"http://x\"\ndescription: d\n---\n")), "rontmatter");
    }

    @Test
    void frontmatterToleraEspacosNoFimDasCercas() {
        assertThatCode(() -> ValidadorPacoteSkill.validarArquivos("seguranca", List.of(new ArquivoSkill("SKILL.md",
                "--- \nname: seguranca\ndescription: d\n---\t\n# Corpo\n")))).doesNotThrowAnyException();
    }

    @Test
    void frontmatterToleraBomUtf8() {
        assertThatCode(() -> ValidadorPacoteSkill.validarArquivos("seguranca", List.of(new ArquivoSkill("SKILL.md",
                "\uFEFF---\nname: seguranca\ndescription: d\n---\n# Corpo\n")))).doesNotThrowAnyException();
    }
}
