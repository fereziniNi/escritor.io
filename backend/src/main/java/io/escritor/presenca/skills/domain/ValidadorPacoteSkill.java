package io.escritor.presenca.skills.domain;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/**
 * Regras do pacote de uma skill (slug, arquivos e frontmatter do SKILL.md), conforme o pedido de
 * proteger o catálogo contra caminhos maliciosos (zip slip) e pacotes desproporcionais.
 */
public final class ValidadorPacoteSkill {

    static final int MAX_ARQUIVOS = 50;
    static final int MAX_BYTES_ARQUIVO = 262144;
    static final int MAX_BYTES_TOTAL = 2097152;
    static final int MAX_CAMINHO = 200;
    static final String ARQUIVO_PRINCIPAL = "SKILL.md";

    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern CAMINHO = Pattern.compile("^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$");

    private ValidadorPacoteSkill() {
    }

    public static void validarSlug(String slug) {
        if (slug == null || slug.length() < 3 || slug.length() > 64 || !SLUG.matcher(slug).matches()) {
            throw new SkillInvalidaException(
                    "O slug deve ter de 3 a 64 caracteres, só letras minúsculas, números e hífens "
                            + "(sem hífen no início, no fim ou duplicado)");
        }
    }

    public static void validarArquivos(String slug, List<ArquivoSkill> arquivos) {
        validarSlug(slug);
        if (arquivos == null || arquivos.isEmpty()) {
            throw new SkillInvalidaException("A skill precisa ter o arquivo SKILL.md na raiz");
        }
        if (arquivos.size() > MAX_ARQUIVOS) {
            throw new SkillInvalidaException("A skill pode ter no máximo " + MAX_ARQUIVOS + " arquivos");
        }
        Set<String> vistos = new HashSet<>();
        long total = 0;
        String skillMd = null;
        for (ArquivoSkill a : arquivos) {
            validarCaminho(a.caminho());
            if (!vistos.add(a.caminho())) {
                throw new SkillInvalidaException("Caminho duplicado: " + a.caminho());
            }
            int bytes = a.conteudo() == null ? 0 : a.conteudo().getBytes(StandardCharsets.UTF_8).length;
            if (bytes > MAX_BYTES_ARQUIVO) {
                throw new SkillInvalidaException(
                        "O arquivo " + a.caminho() + " excede o limite de 256 KB");
            }
            total += bytes;
            if (ARQUIVO_PRINCIPAL.equals(a.caminho())) {
                skillMd = a.conteudo();
            }
        }
        if (total > MAX_BYTES_TOTAL) {
            throw new SkillInvalidaException("A skill excede o limite total de 2 MB");
        }
        if (skillMd == null) {
            throw new SkillInvalidaException("A skill precisa ter o arquivo SKILL.md na raiz");
        }
        Map<String, String> fm = lerFrontmatter(skillMd);
        if (fm.isEmpty()) {
            throw new SkillInvalidaException(
                    "O SKILL.md precisa começar com um frontmatter YAML válido entre linhas ---");
        }
        if (!slug.equals(fm.get("name"))) {
            throw new SkillInvalidaException(
                    "O campo name do frontmatter deve ser igual ao slug (" + slug + ")");
        }
        String descricao = fm.get("description");
        if (descricao == null || descricao.isBlank()) {
            throw new SkillInvalidaException("O campo description do frontmatter é obrigatório");
        }
    }

    private static void validarCaminho(String caminho) {
        boolean ok = caminho != null && caminho.length() <= MAX_CAMINHO && CAMINHO.matcher(caminho).matches();
        if (ok) {
            for (String segmento : caminho.split("/")) {
                if (segmento.equals("..") || segmento.equals(".")) {
                    ok = false;
                }
            }
        }
        if (!ok) {
            throw new SkillInvalidaException("Caminho de arquivo inválido: " + caminho
                    + " (use caminho relativo com letras, números, ponto, hífen, sublinhado e barra, até 200 caracteres)");
        }
    }

    /** Lê o frontmatter (entre a primeira linha --- e a próxima); vazio se ausente ou inválido. */
    public static Map<String, String> lerFrontmatter(String skillMd) {
        if (skillMd == null) {
            return Collections.emptyMap();
        }
        // editores do Windows costumam gravar BOM e deixar espaço depois das cercas ---
        String texto = skillMd.startsWith("\uFEFF") ? skillMd.substring(1) : skillMd;
        String[] linhas = texto.split("\r?\n", -1);
        if (linhas.length == 0 || !linhas[0].stripTrailing().equals("---")) {
            return Collections.emptyMap();
        }
        StringBuilder bloco = new StringBuilder();
        boolean fechou = false;
        for (int i = 1; i < linhas.length; i++) {
            if (linhas[i].stripTrailing().equals("---")) {
                fechou = true;
                break;
            }
            bloco.append(linhas[i]).append('\n');
        }
        if (!fechou) {
            return Collections.emptyMap();
        }
        try {
            Object lido = new Yaml(new SafeConstructor(new LoaderOptions())).load(bloco.toString());
            if (!(lido instanceof Map<?, ?> mapa)) {
                return Collections.emptyMap();
            }
            Map<String, String> r = new LinkedHashMap<>();
            mapa.forEach((k, v) -> {
                if (k != null && v != null) {
                    r.put(String.valueOf(k), String.valueOf(v));
                }
            });
            return r;
        } catch (RuntimeException e) {
            return Collections.emptyMap();
        }
    }
}
