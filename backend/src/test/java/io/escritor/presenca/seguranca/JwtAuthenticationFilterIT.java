package io.escritor.presenca.seguranca;

import io.escritor.presenca.identidade.domain.Papel;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import org.springframework.test.web.servlet.client.RestTestClient;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class JwtAuthenticationFilterIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    @Test
    void tokenValidoDeAdminAutorizaCriarUsuario() {
        String token = jwtService.gerarAccessToken(1L, Papel.ADMIN);

        client().post()
                .uri("/usuarios")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(corpoNovoUsuario("admin-ok@escritor.io"))
                .exchange()
                .expectStatus().isCreated();
    }

    @Test
    void tokenValidoDePapelInferiorERecusadoComForbidden() {
        String token = jwtService.gerarAccessToken(2L, Papel.GESTOR);

        client().post()
                .uri("/usuarios")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(corpoNovoUsuario("gestor-negado@escritor.io"))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void semTokenERecusadoComUnauthorized() {
        client().post()
                .uri("/usuarios")
                .contentType(MediaType.APPLICATION_JSON)
                .body(corpoNovoUsuario("sem-token@escritor.io"))
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void tokenAdulteradoERecusadoComUnauthorized() {
        String token = jwtService.gerarAccessToken(3L, Papel.ADMIN);
        String adulterado = adulterar(token);

        client().post()
                .uri("/usuarios")
                .header("Authorization", "Bearer " + adulterado)
                .contentType(MediaType.APPLICATION_JSON)
                .body(corpoNovoUsuario("token-adulterado@escritor.io"))
                .exchange()
                .expectStatus().isUnauthorized();
    }

    private String corpoNovoUsuario(String email) {
        return """
                {"nome":"Bruno Lima","email":"%s","papel":"COLABORADOR","cargaDiariaMinutos":360}
                """
                .formatted(email);
    }

    /**
     * Troca um caractere no meio do token, não o último. O último caractere de um JWT
     * compacto cai numa fronteira de padding do base64url onde alguns valores decodificam
     * para o mesmo byte — trocar ali pode gerar um token "adulterado" que ainda é válido.
     */
    private static String adulterar(String token) {
        int posicao = token.length() / 2;
        char trocado = token.charAt(posicao) == 'a' ? 'b' : 'a';
        return token.substring(0, posicao) + trocado + token.substring(posicao + 1);
    }
}
