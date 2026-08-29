package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.Instant;
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
 * IT de ponta a ponta de propósito (S5.2): prova a regra de visibilidade de
 * {@code VisibilidadeUsuarioService} (S5.1) contra Postgres/JWT reais, não um mock ensinado a
 * devolver a exceção certa - mesma disciplina de {@code ApontamentoControllerIT} (S4.10).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PontoControllerIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private MembroEquipeRepository membroEquipeRepository;

    @Autowired
    private RegistroPontoRepository registroPontoRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    @Test
    void gestorVeAJornadaDeUmMembroDaEquipeQueLideraDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s52-gestor@escritor.io", Papel.GESTOR, 480));
        Usuario membro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s52-membro@escritor.io", Papel.COLABORADOR, 480));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, gestor, PapelNaEquipe.LIDER));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, membro, PapelNaEquipe.MEMBRO));
        registroPontoRepository.saveAndFlush(new RegistroPonto(
                membro, TipoRegistroPonto.ENTRADA, Instant.now(), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri("/ponto/jornada-do-dia?usuarioId={usuarioId}", membro.getId())
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.estado").isEqualTo("ABERTA");
    }

    @Test
    void colaboradorTentandoVerJornadaDeOutroUsuarioRecebe403DeVerdade() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s52-dono@escritor.io", Papel.COLABORADOR, 480));
        Usuario outro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s52-outro@escritor.io", Papel.COLABORADOR, 480));
        String tokenOutro = jwtService.gerarAccessToken(outro.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/ponto/jornada-do-dia?usuarioId={usuarioId}", dono.getId())
                .header("Authorization", "Bearer " + tokenOutro)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void gestorTentandoVerJornadaDeUsuarioForaDaEquipeQueLideraRecebe403DeVerdade() {
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s52-gestorfora@escritor.io", Papel.GESTOR, 480));
        Usuario forasteiro =
                usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-s52-forasteiro@escritor.io", Papel.COLABORADOR, 480));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri("/ponto/jornada-do-dia?usuarioId={usuarioId}", forasteiro.getId())
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void adminVeOEspelhoDoMesDeQualquerUsuarioDeVerdade() {
        Usuario admin = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s52-admin@escritor.io", Papel.ADMIN, 480));
        Usuario qualquerUsuario =
                usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s52-qualquer@escritor.io", Papel.COLABORADOR, 480));
        String tokenAdmin = jwtService.gerarAccessToken(admin.getId(), Papel.ADMIN);

        client().get()
                .uri("/ponto/espelho-do-mes?usuarioId={usuarioId}", qualquerUsuario.getId())
                .header("Authorization", "Bearer " + tokenAdmin)
                .exchange()
                .expectStatus().isOk();
    }
}
