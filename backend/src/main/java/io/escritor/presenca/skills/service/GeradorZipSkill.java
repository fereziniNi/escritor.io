package io.escritor.presenca.skills.service;

import io.escritor.presenca.skills.domain.ArquivoSkill;
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

    /** Pacote já em valores simples: nunca toca entidades JPA (sem lazy loading fora da transação). */
    public record PacoteZip(String slug, List<ArquivoSkill> arquivos, String tutorial) {
    }

    public byte[] gerar(String slug, List<ArquivoSkill> arquivos, String tutorial) {
        return empacotar(List.of(new PacoteZip(slug, arquivos, tutorial)));
    }

    public byte[] gerarVarias(List<PacoteZip> pacotes) {
        return empacotar(pacotes);
    }

    private byte[] empacotar(List<PacoteZip> pastas) {
        try {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(saida, StandardCharsets.UTF_8)) {
                for (PacoteZip pasta : pastas) {
                    escrever(zip, pasta);
                }
            }
            return saida.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void escrever(ZipOutputStream zip, PacoteZip pasta) throws IOException {
        List<ArquivoSkill> arquivos = pasta.arquivos().stream()
                .sorted(Comparator.comparing(ArquivoSkill::caminho))
                .toList();
        boolean temTutorial = false;
        for (ArquivoSkill arquivo : arquivos) {
            validarNome(pasta.slug());
            validarNome(arquivo.caminho());
            entrada(zip, pasta.slug() + "/" + arquivo.caminho(), arquivo.conteudo());
            temTutorial |= TUTORIAL.equals(arquivo.caminho());
        }
        if (!temTutorial) {
            entrada(zip, pasta.slug() + "/" + TUTORIAL, pasta.tutorial());
        }
    }

    /**
     * Defesa em profundidade (o validador já barra no salvar): nenhum nome com {@code ..} ou
     * absoluto chega ao zip, evitando zip-slip em quem extrai.
     */
    private static void validarNome(String nome) {
        if (nome.startsWith("/") || nome.startsWith("\\") || nome.contains("\\")
                || java.util.Arrays.asList(nome.split("/")).contains("..")) {
            throw new IllegalArgumentException("Nome de entrada inválido no zip: " + nome);
        }
    }

    private void entrada(ZipOutputStream zip, String nome, String conteudo) throws IOException {
        zip.putNextEntry(new ZipEntry(nome));
        zip.write(conteudo.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
