package io.escritor.presenca.skills.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.SkillInvalidaException;
import io.escritor.presenca.skills.service.SkillService.DadosVersao;
import java.io.IOException;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/** Pedido do usuário: skills oficiais versionadas no repositório entram no catálogo ao subir. */
class ImportadorSkillsOficiaisTest {

    private static final String RAIZ = "skills-oficiais-teste";

    private final SkillService skillService = mock(SkillService.class);

    @Test
    void importaFixtureComoOficial() {
        new ImportadorSkillsOficiais(RAIZ, true, skillService).importarTudo();

        ArgumentCaptor<DadosVersao> dados = ArgumentCaptor.forClass(DadosVersao.class);
        verify(skillService).importar(eq("exemplo-teste"), dados.capture(), any());
        DadosVersao d = dados.getValue();
        assertThat(d.nome()).isEqualTo("Exemplo de teste");
        assertThat(d.categoria()).isEqualTo(CategoriaSkill.OUTRAS);
        assertThat(d.promptUso()).contains("exemplo-teste");
        assertThat(d.tutorialInstalacao()).contains("Instalação");
        assertThat(d.arquivos()).extracting(ArquivoSkill::caminho)
                .containsExactlyInAnyOrder("SKILL.md", "referencia/a.ts");
    }

    @Test
    void segundaExecucaoSemMudancaUsaOMesmoHash() {
        ImportadorSkillsOficiais importador = new ImportadorSkillsOficiais(RAIZ, true, skillService);
        importador.importarTudo();
        importador.importarTudo();

        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(skillService, times(2)).importar(eq("exemplo-teste"), any(), hash.capture());
        assertThat(hash.getAllValues().get(0)).hasSize(64).isEqualTo(hash.getAllValues().get(1));
    }

    @Test
    void mudancaNoConteudoGeraOutroHash(@TempDir Path tmp) throws IOException {
        Path copia = copiarFixture(tmp);
        ImportadorSkillsOficiais importador = importadorSobre(tmp);
        importador.importarTudo();
        Files.writeString(copia.resolve("referencia/a.ts"), "export const a = 2;\n");
        importador.importarTudo();

        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(skillService, times(2)).importar(eq("exemplo-teste"), any(), hash.capture());
        assertThat(hash.getAllValues().get(0)).isNotEqualTo(hash.getAllValues().get(1));
    }

    @Test
    void mudancaSoNoCatalogoTambemMudaOHash(@TempDir Path tmp) throws IOException {
        Path copia = copiarFixture(tmp);
        ImportadorSkillsOficiais importador = importadorSobre(tmp);
        importador.importarTudo();
        Files.writeString(copia.resolve("_catalogo/prompt.md"), "Outro prompt\n");
        importador.importarTudo();

        ArgumentCaptor<String> hash = ArgumentCaptor.forClass(String.class);
        verify(skillService, times(2)).importar(eq("exemplo-teste"), any(), hash.capture());
        assertThat(hash.getAllValues().get(0)).isNotEqualTo(hash.getAllValues().get(1));
    }

    @Test
    void skillQuebradaNaoImpedeAsOutras(@TempDir Path tmp) throws IOException {
        copiarFixture(tmp);
        Path ruim = tmp.resolve(RAIZ + "/ruim-demais");
        Files.createDirectories(ruim);
        Files.writeString(ruim.resolve("SKILL.md"), "sem frontmatter");

        importadorSobre(tmp).importarTudo();

        verify(skillService).importar(eq("exemplo-teste"), any(), any());
        verify(skillService, never()).importar(eq("ruim-demais"), any(), any());
    }

    @Test
    void erroDoServicoEmUmaSkillNaoPropaga(@TempDir Path tmp) throws IOException {
        copiarFixture(tmp);
        doThrow(new SkillInvalidaException("boom")).when(skillService)
                .importar(eq("exemplo-teste"), any(), any());

        importadorSobre(tmp).importarTudo();

        verify(skillService).importar(eq("exemplo-teste"), any(), any());
    }

    @Test
    void desligadoPelaPropriedadeNaoImporta() {
        new ImportadorSkillsOficiais(RAIZ, false, skillService).importarTudo();
        verify(skillService, never()).importar(any(), any(), any());
    }

    @Test
    void raizInexistenteOuSoComGitkeepNaoFalha() {
        new ImportadorSkillsOficiais("nao-existe-mesmo", true, skillService).importarTudo();
        verify(skillService, never()).importar(any(), any(), any());
        assertThat(new ImportadorSkillsOficiais("skills-oficiais", true, skillService).listarSlugs()).isEmpty();
    }

    private ImportadorSkillsOficiais importadorSobre(Path tmp) throws IOException {
        URLClassLoader loader = new URLClassLoader(new URL[] {tmp.toUri().toURL()}, null);
        return new ImportadorSkillsOficiais(RAIZ, true, skillService,
                new PathMatchingResourcePatternResolver(loader));
    }

    private Path copiarFixture(Path tmp) throws IOException {
        Path origem = Path.of("src/test/resources/" + RAIZ + "/exemplo-teste");
        Path destino = tmp.resolve(RAIZ + "/exemplo-teste");
        try (Stream<Path> s = Files.walk(origem)) {
            for (Path p : (Iterable<Path>) s::iterator) {
                Path alvo = destino.resolve(origem.relativize(p).toString());
                if (Files.isDirectory(p)) {
                    Files.createDirectories(alvo);
                } else {
                    Files.createDirectories(alvo.getParent());
                    Files.copy(p, alvo, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
        return destino;
    }
}
