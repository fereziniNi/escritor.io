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
                // 28x20 desde V24 (mapa cresceu pra caber 4 salas maiores, redesenhadas por função)
                .jsonPath("$.larguraTiles").isEqualTo(28)
                .jsonPath("$.alturaTiles").isEqualTo(20)
                // 4 zonas desde V23/V24 (layout reorganizado: salas espalhadas em vez de uma
                // fileira só no topo - Reuniões/Café/Área de trabalho/Fora do trabalho)
                .jsonPath("$.zonas.length()").isEqualTo(4);
    }

    @Test
    void semAutenticacaoRecebe401DeVerdade() {
        client().get().uri("/mapas/ativo").exchange().expectStatus().isUnauthorized();
    }
}
