package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * IT de ponta a ponta de propósito (S5.6): prova que `GET /ajustes/pendentes` (S2.12, antes sem
 * filtro nenhum) passa a respeitar `VisibilidadeUsuarioService` (S5.1) contra Postgres/JWT reais,
 * mesma disciplina de `PontoControllerIT` (S5.2).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SolicitacaoAjusteControllerIT {

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
    private SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    @Test
    void gestorVeSoSolicitacoesDeMembrosDasEquipesQueLideraDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s56-gestor@escritor.io", Papel.GESTOR, 480));
        Usuario membro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s56-membro@escritor.io", Papel.COLABORADOR, 480));
        Usuario forasteiro = usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-s56-forasteiro@escritor.io", Papel.COLABORADOR, 480));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, gestor, PapelNaEquipe.LIDER));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, membro, PapelNaEquipe.MEMBRO));
        solicitacaoAjustePontoRepository.saveAndFlush(new SolicitacaoAjustePonto(
                membro, null, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T09:00:00Z"), "Esqueci de bater"));
        solicitacaoAjustePontoRepository.saveAndFlush(new SolicitacaoAjustePonto(
                forasteiro, null, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T09:00:00Z"), "Esqueci de bater"));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri("/ajustes/pendentes")
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].usuarioNome").isEqualTo(membro.getNome());
    }

    @Test
    void adminVeTodasAsSolicitacoesPendentesDeVerdade() {
        Usuario admin = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s56-admin@escritor.io", Papel.ADMIN, 480));
        Usuario qualquerUsuario =
                usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s56-qualquer@escritor.io", Papel.COLABORADOR, 480));
        solicitacaoAjustePontoRepository.saveAndFlush(new SolicitacaoAjustePonto(
                qualquerUsuario, null, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T09:00:00Z"), "Esqueci de bater"));
        String tokenAdmin = jwtService.gerarAccessToken(admin.getId(), Papel.ADMIN);

        var resposta = client().get()
                .uri("/ajustes/pendentes")
                .header("Authorization", "Bearer " + tokenAdmin)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .returnResult()
                .getResponseBody();

        assertThat(new String(resposta)).contains(qualquerUsuario.getNome());
    }
}
