package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.seguranca.JwtService;
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
 * IT de ponta a ponta de propósito: prova que o serviço encerra o timer anterior *antes* de
 * inserir o novo - se a ordem estivesse errada, o índice único parcial de S4.1
 * (`uk_apontamento_timer_aberto_por_usuario`) rejeitaria o segundo `POST` com 500, não um mock
 * ensinado a "funcionar" escondendo esse bug.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApontamentoControllerIT {

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
    private QuadroRepository quadroRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private ApontamentoRepository apontamentoRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    @Test
    void iniciarUmSegundoTimerEncerraOPrimeiroDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-apt@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var cardA = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        var cardB = cardRepository.saveAndFlush(new Card(coluna, "Card B", null, 2048.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        Long primeiroId = client().post()
                .uri("/cards/{id}/apontamentos/timer", cardA.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().post()
                .uri("/cards/{id}/apontamentos/timer", cardB.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.cardId").isEqualTo(cardB.getId())
                .jsonPath("$.fim").doesNotExist();

        var primeiro = apontamentoRepository.findById(primeiroId).orElseThrow();
        assertThat(primeiro.getFim()).isNotNull();
        assertThat(primeiro.getMinutos()).isNotNull();
        assertThat(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario)).isPresent();
        assertThat(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario).orElseThrow().getCard().getId())
                .isEqualTo(cardB.getId());
    }
}
