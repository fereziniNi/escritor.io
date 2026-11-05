package io.escritor.presenca.skills.service;

import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.stereotype.Component;

/**
 * Pedido do usuário: baixar a skill em zip pronto para instalar. Cada skill vira a pasta
 * {@code <slug>/} com os arquivos da versão mais o {@code TUTORIAL.md}; se a própria versão já
 * tem um {@code TUTORIAL.md} na raiz, ele prevalece (sem entrada duplicada).
 */
@Component
public class GeradorZipSkill {

    static final String TUTORIAL = "TUTORIAL.md";

    public byte[] gerar(String slug, SkillVersao versao) {
        return empacotar(List.of(new Pasta(slug, versao)));
    }

    /** Usa a versão vigente de cada skill, cada uma na sua pasta. */
    public byte[] gerarVarias(List<Skill> skills) {
        return empacotar(skills.stream().map(s -> new Pasta(s.getSlug(), s.getVersaoVigente())).toList());
    }

    private record Pasta(String slug, SkillVersao versao) {
    }

    private byte[] empacotar(List<Pasta> pastas) {
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(saida, StandardCharsets.UTF_8)) {
                for (Pasta pasta : pastas) {
                    escrever(zip, pasta);
                }
            }
            return saida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void escrever(ZipOutputStream zip, Pasta pasta) throws IOException {
        List<ArquivoSkill> arquivos = pasta.versao().arquivosComoValor().stream()
                .sorted(Comparator.comparing(ArquivoSkill::caminho))
                .toList();
        boolean temTutorial = false;
        for (ArquivoSkill arquivo : arquivos) {
            entrada(zip, pasta.slug() + "/" + arquivo.caminho(), arquivo.conteudo());
            temTutorial |= TUTORIAL.equals(arquivo.caminho());
        }
        if (!temTutorial) {
            entrada(zip, pasta.slug() + "/" + TUTORIAL, pasta.versao().getTutorialInstalacao());
        }
    }

    private void entrada(ZipOutputStream zip, String nome, String conteudo) throws IOException {
        zip.putNextEntry(new ZipEntry(nome));
        zip.write(conteudo.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
