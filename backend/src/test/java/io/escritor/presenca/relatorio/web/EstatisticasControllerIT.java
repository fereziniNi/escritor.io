package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
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
 * Bug de produção (26/10): com uma reunião com participantes no período, `GET
 * /relatorios/estatisticas` devolvia 500 - `LazyInitializationException` ao ler
 * `Reuniao.participantes` fora de sessão (`open-in-view: false` e o serviço sem transação).
 * Os testes com mock não pegam: só aparece com Hibernate/Postgres de verdade.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EstatisticasControllerIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ReuniaoRepository reuniaoRepository;

    @Test
    void estatisticasComReuniaoNoPeriodoContamOsParticipantes() {
        Usuario admin = usuarioRepository.saveAndFlush(new Usuario("Ana Admin", "ana-estatisticas-it@escritor.io", Papel.ADMIN, 480));
        Usuario colega = usuarioRepository.saveAndFlush(new Usuario("Beto Colega", "beto-estatisticas-it@escritor.io", Papel.COLABORADOR, 480));
        reuniaoRepository.saveAndFlush(new Reuniao(
                admin, List.of(admin, colega), LocalDate.of(2026, 10, 26), LocalTime.of(14, 0), LocalTime.of(15, 0),
                "Planejamento", Instant.parse("2026-10-26T12:00:00Z")));
        String token = jwtService.gerarAccessToken(admin.getId(), Papel.ADMIN);

        RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build()
                .get()
                .uri("/relatorios/estatisticas?inicio=2026-10-01T03:00:00Z&fim=2026-10-27T03:00:00Z")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.equipe.rankingReunioes[?(@.nome == 'Ana Admin')].valor").isEqualTo(1)
                .jsonPath("$.equipe.rankingReunioes[?(@.nome == 'Beto Colega')].valor").isEqualTo(1)
                .jsonPath("$.equipe.reunioesPorHoraDoDia[14]").isEqualTo(1);
    }
}
