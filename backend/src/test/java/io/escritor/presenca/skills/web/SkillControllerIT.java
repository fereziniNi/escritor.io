package io.escritor.presenca.skills.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * IT de ponta a ponta do catálogo de skills contra Postgres real: criar, oficializar, propor
 * (mesmo autor substitui, outra pessoa recebe 409), aprovar e baixar os zips.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SkillControllerIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    private String token(String nome, String email, Papel papel) {
        Usuario u = usuarioRepository.saveAndFlush(new Usuario(nome, email, papel, 480));
        return "Bearer " + jwtService.gerarAccessToken(u.getId(), papel);
    }

    private static String corpo(String slug, String conteudo, String mensagem) {
        String raiz = slug == null ? "" : "\"slug\":\"" + slug + "\",";
        String skillMd = "---\\nname: " + (slug == null ? "fluxo-catalogo" : slug)
                + "\\ndescription: Skill de teste\\n---\\n" + conteudo;
        return "{" + raiz + "\"nome\":\"Fluxo\",\"descricao\":\"Skill de teste\",\"categoria\":\"IA\","
                + "\"promptUso\":\"use\",\"tutorialInstalacao\":\"instale\",\"mensagem\":\"" + mensagem + "\","
                + "\"arquivos\":[{\"caminho\":\"SKILL.md\",\"conteudo\":\"" + skillMd + "\"}]}";
    }

    private Map<String, String> baixar(String uri, String auth) {
        byte[] bytes = client().get().uri(uri).header("Authorization", auth).exchange()
                .expectStatus().isOk()
                .expectHeader().contentType("application/zip")
                .expectBody(byte[].class).returnResult().getResponseBody();
        Map<String, String> entradas = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                entradas.put(e.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        } catch (java.io.IOException ex) {
            throw new IllegalStateException(ex);
        }
        return entradas;
    }

    @Test
    void fluxoCompletoDeCriarOficializarProporAprovarEBaixar() {
        String ana = token("Ana Souza", "ana-skill@escritor.io", Papel.COLABORADOR);
        String beto = token("Beto Lima", "beto-skill@escritor.io", Papel.COLABORADOR);
        String gil = token("Gil Gestor", "gil-skill@escritor.io", Papel.GESTOR);
        String slug = "fluxo-catalogo";

        client().post().uri("/skills").header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
                .body(corpo(slug, "versao um", "criada")).exchange()
                .expectStatus().isCreated()
                .expectBody().jsonPath("$.numero").isEqualTo(1).jsonPath("$.estado").isEqualTo("PUBLICADA");

        // colaborador não oficializa; gestor sim
        client().put().uri("/skills/{s}/oficial", slug).header("Authorization", ana)
                .contentType(MediaType.APPLICATION_JSON).body("{\"valor\":true}").exchange()
                .expectStatus().isForbidden();
        client().put().uri("/skills/{s}/oficial", slug).header("Authorization", gil)
                .contentType(MediaType.APPLICATION_JSON).body("{\"valor\":true}").exchange()
                .expectStatus().isNoContent();

        // skill oficial: salvar vira proposta
        client().post().uri("/skills/{s}/versoes", slug).header("Authorization", ana)
                .contentType(MediaType.APPLICATION_JSON).body(corpo(null, "versao dois", "proposta 1")).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.numero").isEqualTo(2).jsonPath("$.estado").isEqualTo("PROPOSTA");

        // mesmo autor salva de novo: substitui, sem 500
        client().post().uri("/skills/{s}/versoes", slug).header("Authorization", ana)
                .contentType(MediaType.APPLICATION_JSON).body(corpo(null, "versao tres ação", "proposta 2")).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.numero").isEqualTo(3).jsonPath("$.estado").isEqualTo("PROPOSTA");

        // outra pessoa: 409 com mensagem
        client().post().uri("/skills/{s}/versoes", slug).header("Authorization", beto)
                .contentType(MediaType.APPLICATION_JSON).body(corpo(null, "intruso", "outra")).exchange()
                .expectStatus().isEqualTo(409)
                .expectBody().jsonPath("$.mensagem").value(m -> assertThat((String) m).contains("Ana Souza"));

        // fila de propostas: só gestor; e a rota não cai em /skills/{slug}
        client().get().uri("/skills/propostas").header("Authorization", ana).exchange().expectStatus().isForbidden();
        client().get().uri("/skills/propostas").header("Authorization", gil).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$[0].slug").isEqualTo(slug).jsonPath("$[0].numero").isEqualTo(3);

        // detalhe ainda mostra a vigente (v1) e a proposta pendente
        client().get().uri("/skills/{s}", slug).header("Authorization", beto).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.vigente.numero").isEqualTo(1)
                .jsonPath("$.propostaPendente.numero").isEqualTo(3);

        // zip antes da aprovação ainda é o da vigente
        assertThat(baixar("/skills/" + slug + "/zip", beto).get(slug + "/SKILL.md")).contains("versao um");

        client().post().uri("/skills/{s}/versoes/3/aprovar", slug).header("Authorization", gil).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.estado").isEqualTo("PUBLICADA");

        Map<String, String> zip = baixar("/skills/" + slug + "/zip", beto);
        assertThat(zip.get(slug + "/SKILL.md")).contains("versao tres ação");
        assertThat(zip).containsKey(slug + "/TUTORIAL.md");

        Map<String, String> oficiais = baixar("/skills/oficiais.zip", beto);
        assertThat(oficiais.get(slug + "/SKILL.md")).contains("versao tres ação");
    }

    @Test
    void slugInvalidoRetorna400ComMensagem() {
        String ana = token("Ana Dois", "ana2-skill@escritor.io", Papel.COLABORADOR);

        client().post().uri("/skills").header("Authorization", ana).contentType(MediaType.APPLICATION_JSON)
                .body(corpo("Slug_Ruim", "x", "criada")).exchange()
                .expectStatus().isBadRequest()
                .expectBody().jsonPath("$.mensagem").exists();
    }
}
