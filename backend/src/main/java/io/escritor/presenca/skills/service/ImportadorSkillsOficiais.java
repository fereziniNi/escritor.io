package io.escritor.presenca.skills.service;

import io.escritor.presenca.seguranca.HashSha256;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.SkillInvalidaException;
import io.escritor.presenca.skills.domain.ValidadorPacoteSkill;
import io.escritor.presenca.skills.service.SkillService.DadosVersao;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriUtils;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/**
 * Pedido do usuário: as skills oficiais ficam versionadas no repositório
 * ({@code skills-oficiais/<slug>/}) e entram no catálogo quando o backend sobe. Cada pasta tem os
 * arquivos da skill mais {@code _catalogo/meta.yml}, {@code prompt.md} e {@code tutorial.md}; a
 * pasta {@code _catalogo} alimenta os metadados e não vira arquivo da skill. Uma pasta quebrada é
 * registrada em log (ERROR) e não impede as demais nem a subida da aplicação.
 */
@Component
public class ImportadorSkillsOficiais {

    private static final Logger log = LoggerFactory.getLogger(ImportadorSkillsOficiais.class);

    static final String PASTA_CATALOGO = "_catalogo/";
    private static final String ARQUIVO_VAZIO = ".gitkeep";

    /** Skill lida do disco/jar, já validada, com o hash do conjunto inteiro. */
    public record Pacote(String slug, DadosVersao dados, String hash) {
    }

    private final String raiz;
    private final boolean ativo;
    private final SkillService skillService;
    private final ResourcePatternResolver resolver;

    @Autowired
    public ImportadorSkillsOficiais(
            @Value("${escritorio.skills.raiz-oficiais:skills-oficiais}") String raizClasspath,
            @Value("${escritorio.skills.importar-oficiais:true}") boolean ativo,
            SkillService skillService) {
        this(raizClasspath, ativo, skillService, new PathMatchingResourcePatternResolver());
    }

    ImportadorSkillsOficiais(String raizClasspath, boolean ativo, SkillService skillService,
            ResourcePatternResolver resolver) {
        this.raiz = raizClasspath;
        this.ativo = ativo;
        this.skillService = skillService;
        this.resolver = resolver;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void importarTudo() {
        if (!ativo) {
            log.info("Importação das skills oficiais desligada");
            return;
        }
        Map<String, Map<String, String>> porSlug;
        try {
            porSlug = lerArquivos();
        } catch (IOException | RuntimeException e) {
            log.error("Não foi possível ler as skills oficiais em {}: {}", raiz, e.toString());
            return;
        }
        for (String slug : porSlug.keySet()) {
            try {
                Pacote p = montar(slug, porSlug.get(slug));
                skillService.importar(p.slug(), p.dados(), p.hash());
            } catch (RuntimeException e) {
                log.error("Skill oficial '{}' não importada: {}", slug, e.getMessage(), e);
            }
        }
    }

    /** Slugs (nomes de pasta) encontrados na raiz, em ordem alfabética. */
    public List<String> listarSlugs() {
        try {
            return new ArrayList<>(new TreeSet<>(lerArquivos().keySet()));
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao ler " + raiz, e);
        }
    }

    /** Lê e valida uma pasta; lança {@link SkillInvalidaException} se ela não servir. */
    public Pacote carregar(String slug) {
        try {
            Map<String, String> arquivos = lerArquivos().get(slug);
            if (arquivos == null) {
                throw new SkillInvalidaException("Pasta não encontrada: " + slug);
            }
            return montar(slug, arquivos);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao ler " + raiz, e);
        }
    }

    // ---------- internos ----------

    private Pacote montar(String slug, Map<String, String> todos) {
        ValidadorPacoteSkill.validarSlug(slug);
        List<ArquivoSkill> arquivos = new ArrayList<>();
        todos.forEach((caminho, conteudo) -> {
            if (!caminho.startsWith(PASTA_CATALOGO)) {
                arquivos.add(new ArquivoSkill(caminho, conteudo));
            }
        });
        ValidadorPacoteSkill.validarArquivos(slug, arquivos);

        Map<String, Object> meta = lerMeta(todos.get(PASTA_CATALOGO + "meta.yml"));
        String nome = texto(meta, "nome");
        String descricao = texto(meta, "descricao");
        CategoriaSkill categoria;
        try {
            categoria = CategoriaSkill.valueOf(texto(meta, "categoria"));
        } catch (IllegalArgumentException e) {
            throw new SkillInvalidaException("meta.yml: categoria inválida (" + meta.get("categoria") + ")");
        }
        String prompt = exigir(todos, PASTA_CATALOGO + "prompt.md");
        String tutorial = exigir(todos, PASTA_CATALOGO + "tutorial.md");

        DadosVersao dados = new DadosVersao(nome, descricao, categoria, prompt, tutorial, null, arquivos);
        return new Pacote(slug, dados, hash(todos));
    }

    private static String exigir(Map<String, String> todos, String caminho) {
        String c = todos.get(caminho);
        if (c == null || c.isBlank()) {
            throw new SkillInvalidaException("Arquivo obrigatório ausente ou vazio: " + caminho);
        }
        return c;
    }

    private static Map<String, Object> lerMeta(String yaml) {
        if (yaml == null) {
            throw new SkillInvalidaException("Arquivo obrigatório ausente: " + PASTA_CATALOGO + "meta.yml");
        }
        Object lido;
        try {
            lido = new Yaml(new SafeConstructor(new LoaderOptions())).load(yaml);
        } catch (RuntimeException e) {
            throw new SkillInvalidaException("meta.yml inválido: " + e.getMessage());
        }
        if (!(lido instanceof Map<?, ?> mapa)) {
            throw new SkillInvalidaException("meta.yml deve ser um mapa com nome, descricao e categoria");
        }
        Map<String, Object> r = new TreeMap<>();
        mapa.forEach((k, v) -> r.put(String.valueOf(k), v));
        return r;
    }

    private static String texto(Map<String, Object> meta, String chave) {
        Object v = meta.get(chave);
        if (v == null || String.valueOf(v).isBlank()) {
            throw new SkillInvalidaException("meta.yml: campo obrigatório ausente: " + chave);
        }
        return String.valueOf(v).trim();
    }

    /** SHA-256 de caminho, tamanho e conteúdo de cada arquivo (ordenados), com separadores NUL. */
    private static String hash(Map<String, String> todos) {
        StringBuilder sb = new StringBuilder();
        new TreeMap<>(todos).forEach((caminho, conteudo) -> sb.append(caminho).append('\0')
                .append(conteudo.length()).append('\0').append(conteudo).append('\0'));
        return HashSha256.hash(sb.toString());
    }

    /** slug -> (caminho relativo à pasta da skill -> conteúdo UTF-8). */
    private Map<String, Map<String, String>> lerArquivos() throws IOException {
        List<String> prefixos = new ArrayList<>();
        for (Resource r : resolver.getResources("classpath*:" + raiz + "/")) {
            prefixos.add(r.getURL().toString());
        }
        Map<String, Map<String, String>> r = new TreeMap<>();
        for (Resource res : resolver.getResources("classpath*:" + raiz + "/**")) {
            String url = res.getURL().toString();
            if (url.endsWith("/") || !res.isReadable()) {
                continue;
            }
            String relativo = relativo(url, prefixos);
            if (relativo == null) {
                continue;
            }
            int barra = relativo.indexOf('/');
            if (barra <= 0) {
                continue; // arquivo solto na raiz (.gitkeep, README) não é skill
            }
            String slug = relativo.substring(0, barra);
            String caminho = relativo.substring(barra + 1);
            if (caminho.equals(ARQUIVO_VAZIO)) {
                continue;
            }
            String conteudo = normalizar(new String(res.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
            r.computeIfAbsent(slug, k -> new TreeMap<>(Comparator.naturalOrder())).put(caminho, conteudo);
        }
        return r;
    }

    /** Tira BOM inicial e unifica fim de linha em \n, para o hash não depender do checkout. */
    static String normalizar(String texto) {
        String t = texto.startsWith("﻿") ? texto.substring(1) : texto;
        return t.replace("\r\n", "\n").replace('\r', '\n');
    }

    private String relativo(String url, List<String> prefixos) {
        String achado = null;
        for (String p : prefixos) {
            if (url.startsWith(p)) {
                achado = url.substring(p.length());
                break;
            }
        }
        if (achado == null) {
            String marca = "/" + raiz + "/";
            int i = url.indexOf(marca);
            if (i < 0) {
                return null;
            }
            achado = url.substring(i + marca.length());
        }
        return UriUtils.decode(achado, StandardCharsets.UTF_8);
    }
}
