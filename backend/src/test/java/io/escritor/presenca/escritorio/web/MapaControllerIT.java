package io.escritor.presenca.escritorio.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * IT de ponta a ponta (S6.2): prova que `GET /mapas/ativo` lê de verdade o mapa e as zonas
 * seedados pela migração (V20/V21), via JWT/Postgres reais - não um mock ensinado a devolver os
 * dados certos. Qualquer papel autenticado enxerga o mapa (PRD: mover avatar/usar o mapa é ação
 * de qualquer usuário, não só gestor/admin), por isso o teste usa COLABORADOR, o papel mais
 * restrito.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MapaControllerIT {

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

    @Test
    void colaboradorVeOMapaAtivoSeedadoPelaMigracaoDeVerdade() {
        Usuario colaborador =
                usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s62-colaborador@escritor.io", Papel.COLABORADOR, 480));
        String token = jwtService.gerarAccessToken(colaborador.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/mapas/ativo")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.nome").isEqualTo("Escritório")
                // 36x27 desde V51 (V50 cresceu pra 36x22 pra caber a coluna de cabines; V51
                // empurrou tudo 5 linhas pra baixo - "o mapa... tem 4 quadrados [vazios] embaixo e
                // só 1 em cima" - pra equilibrar melhor a margem vertical)
                .jsonPath("$.larguraTiles").isEqualTo(36)
                .jsonPath("$.alturaTiles").isEqualTo(27)
                // 8 zonas desde V49 (Reuniões/Café/Área de trabalho/Fora do trabalho/Happy Hour +
                // as 3 cabines fechadas)
                .jsonPath("$.zonas.length()").isEqualTo(8);
    }

    @Test
    void semAutenticacaoRecebe401DeVerdade() {
        client().get().uri("/mapas/ativo").exchange().expectStatus().isUnauthorized();
    }
}
