package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.Instant;
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
 * IT de ponta a ponta de propósito (S4.2/S4.3): prova que o serviço encerra o timer anterior
 * *antes* de inserir o novo - se a ordem estivesse errada, o índice único parcial de S4.1
 * (`uk_apontamento_timer_aberto_por_usuario`) rejeitaria o segundo `POST` com 500, não um mock
 * ensinado a "funcionar" escondendo esse bug. Também prova os 403/409 de `parar` contra a
 * autenticação/autorização reais, não um serviço mockado ensinado a devolver a exceção certa.
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

    @Autowired
    private MembroEquipeRepository membroEquipeRepository;

    @Autowired
    private ProjetoRepository projetoRepository;

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

    @Test
    void pararEncerraOTimerDeVerdadeEDepoisPermiteAbrirOutro() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-parar@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos/timer", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().patch()
                .uri("/apontamentos/{id}/parar", apontamentoId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.fim").exists()
                .jsonPath("$.minutos").exists();

        assertThat(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario)).isEmpty();

        // encerrado de verdade em banco (não só na resposta) - abrir outro timer não esbarra
        // no índice único parcial, provando que o primeiro realmente ficou com fim preenchido.
        client().post()
                .uri("/cards/{id}/apontamentos/timer", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isCreated();
    }

    @Test
    void pararApontamentoDeOutroUsuarioRecebe403DeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-dono@escritor.io", Papel.COLABORADOR, 480));
        Usuario outro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-outro@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, dono));
        String tokenDono = jwtService.gerarAccessToken(dono.getId(), Papel.COLABORADOR);
        String tokenOutro = jwtService.gerarAccessToken(outro.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos/timer", card.getId())
                .header("Authorization", "Bearer " + tokenDono)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().patch()
                .uri("/apontamentos/{id}/parar", apontamentoId)
                .header("Authorization", "Bearer " + tokenOutro)
                .exchange()
                .expectStatus().isForbidden();

        assertThat(apontamentoRepository.findById(apontamentoId).orElseThrow().getFim()).isNull();
    }

    @Test
    void pararApontamentoJaEncerradoRecebe409DeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-409@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos/timer", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();
        client().patch()
                .uri("/apontamentos/{id}/parar", apontamentoId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk();

        client().patch()
                .uri("/apontamentos/{id}/parar", apontamentoId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isEqualTo(409);
    }

    @Test
    void criaLancamentoManualComMinutosDireto() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-manual@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"minutos":120,"descricao":"Pareamento"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.minutos").isEqualTo(120)
                .jsonPath("$.origem").isEqualTo("MANUAL")
                .jsonPath("$.descricao").isEqualTo("Pareamento")
                .jsonPath("$.fim").exists();
    }

    @Test
    void criaLancamentoManualComIntervaloExplicito() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-manual2@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"inicio":"2026-01-15T09:00:00Z","fim":"2026-01-15T10:30:00Z"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.minutos").isEqualTo(90)
                .jsonPath("$.origem").isEqualTo("MANUAL");
    }

    @Test
    void criarLancamentoManualComMinutosEIntervaloJuntosRecebe400DeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-manual3@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"inicio":"2026-01-15T09:00:00Z","fim":"2026-01-15T10:30:00Z","minutos":90}
                        """)
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void editarRecalculaMinutosEPersisteDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-editar@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"inicio":"2026-01-15T09:00:00Z","fim":"2026-01-15T09:30:00Z"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().patch()
                .uri("/apontamentos/{id}", apontamentoId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"fim":"2026-01-15T10:30:00Z","descricao":"Corrigido"}
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.minutos").isEqualTo(90)
                .jsonPath("$.descricao").isEqualTo("Corrigido");

        // recalculado e persistido de verdade em banco, não só na resposta.
        var salvo = apontamentoRepository.findById(apontamentoId).orElseThrow();
        assertThat(salvo.getMinutos()).isEqualTo(90);
        assertThat(salvo.getDescricao()).isEqualTo("Corrigido");
    }

    @Test
    void editarApontamentoDeOutroUsuarioRecebe403DeVerdadeENaoMudaNada() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-editar-dono@escritor.io", Papel.COLABORADOR, 480));
        Usuario outro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-editar-outro@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, dono));
        String tokenDono = jwtService.gerarAccessToken(dono.getId(), Papel.COLABORADOR);
        String tokenOutro = jwtService.gerarAccessToken(outro.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + tokenDono)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"minutos":60,"descricao":"Original"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().patch()
                .uri("/apontamentos/{id}", apontamentoId)
                .header("Authorization", "Bearer " + tokenOutro)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"descricao":"Invadido"}
                        """)
                .exchange()
                .expectStatus().isForbidden();

        assertThat(apontamentoRepository.findById(apontamentoId).orElseThrow().getDescricao()).isEqualTo("Original");
    }

    @Test
    void excluirRemoveALinhaDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-excluir@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"minutos":30}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().delete()
                .uri("/apontamentos/{id}", apontamentoId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNoContent();

        assertThat(apontamentoRepository.findById(apontamentoId)).isEmpty();
    }

    @Test
    void excluirApontamentoDeOutroUsuarioRecebe403DeVerdadeENaoApaga() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-excluir-dono@escritor.io", Papel.COLABORADOR, 480));
        Usuario outro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-excluir-outro@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, dono));
        String tokenDono = jwtService.gerarAccessToken(dono.getId(), Papel.COLABORADOR);
        String tokenOutro = jwtService.gerarAccessToken(outro.getId(), Papel.COLABORADOR);

        Long apontamentoId = client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + tokenDono)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"minutos":30}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(ApontamentoResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().delete()
                .uri("/apontamentos/{id}", apontamentoId)
                .header("Authorization", "Bearer " + tokenOutro)
                .exchange()
                .expectStatus().isForbidden();

        assertThat(apontamentoRepository.findById(apontamentoId)).isPresent();
    }

    @Test
    void listaOsApontamentosDoCardMaisRecentePrimeiroDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-listar@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        var card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"inicio":"2026-01-15T09:00:00Z","fim":"2026-01-15T09:30:00Z","descricao":"Primeiro"}
                        """)
                .exchange()
                .expectStatus().isCreated();

        client().post()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"inicio":"2026-01-15T10:00:00Z","fim":"2026-01-15T10:30:00Z","descricao":"Segundo"}
                        """)
                .exchange()
                .expectStatus().isCreated();

        client().get()
                .uri("/cards/{id}/apontamentos", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2)
                .jsonPath("$[0].descricao").isEqualTo("Segundo")
                .jsonPath("$[1].descricao").isEqualTo("Primeiro");
    }

    @Test
    void listarApontamentosDeCardInexistenteRecebe404DeVerdade() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-listar-404@escritor.io", Papel.COLABORADOR, 480));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/cards/{id}/apontamentos", 999999)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void colaboradorVeOsProprosApontamentosNoPeriodoDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-self@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, card, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/apontamentos?inicio={inicio}&fim={fim}", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    void colaboradorTentandoVerApontamentosDeOutroUsuarioRecebe403DeVerdade() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-dono@escritor.io", Papel.COLABORADOR, 480));
        Usuario outro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s410-outro@escritor.io", Papel.COLABORADOR, 480));
        String tokenOutro = jwtService.gerarAccessToken(outro.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/apontamentos?usuarioId={usuarioId}&inicio={inicio}&fim={fim}", dono.getId(), "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenOutro)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void gestorVeApontamentosDeMembroDaEquipeQueLideraDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-gestor@escritor.io", Papel.GESTOR, 480));
        Usuario membro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s410-membro@escritor.io", Papel.COLABORADOR, 480));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, gestor, PapelNaEquipe.LIDER));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, membro, PapelNaEquipe.MEMBRO));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, membro));
        apontamentoRepository.saveAndFlush(new Apontamento(
                membro, card, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri("/apontamentos?usuarioId={usuarioId}&inicio={inicio}&fim={fim}", membro.getId(), "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    void gestorTentandoVerApontamentosDeUsuarioForaDaEquipeQueLideraRecebe403DeVerdade() {
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-gestorfora@escritor.io", Papel.GESTOR, 480));
        Usuario forasteiro = usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-s410-forasteiro@escritor.io", Papel.COLABORADOR, 480));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri(
                        "/apontamentos?usuarioId={usuarioId}&inicio={inicio}&fim={fim}",
                        forasteiro.getId(),
                        "2026-01-01T00:00:00Z",
                        "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void adminVeApontamentosDeQualquerUsuarioDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario admin = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-admin@escritor.io", Papel.ADMIN, 480));
        Usuario qualquerUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s410-qualquer@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, qualquerUsuario));
        apontamentoRepository.saveAndFlush(new Apontamento(
                qualquerUsuario, card, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        String tokenAdmin = jwtService.gerarAccessToken(admin.getId(), Papel.ADMIN);

        client().get()
                .uri(
                        "/apontamentos?usuarioId={usuarioId}&inicio={inicio}&fim={fim}",
                        qualquerUsuario.getId(),
                        "2026-01-01T00:00:00Z",
                        "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenAdmin)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    void listarApontamentosComUsuarioIdInexistenteRecebe404DeVerdade() {
        Usuario admin = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s410-admin404@escritor.io", Papel.ADMIN, 480));
        String tokenAdmin = jwtService.gerarAccessToken(admin.getId(), Papel.ADMIN);

        client().get()
                .uri("/apontamentos?usuarioId={usuarioId}&inicio={inicio}&fim={fim}", 999999, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenAdmin)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void listaOTotalApontadoPorCardDeVerdadeIgnorandoTimerAberto() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s54-porcard@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card cardA = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, usuario));
        Card cardB = cardRepository.saveAndFlush(new Card(coluna, "Card B", null, 2048.0, null, null, null, usuario));
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, cardA, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, cardA, Instant.parse("2026-01-16T09:00:00Z"), Instant.parse("2026-01-16T09:30:00Z"), null, OrigemApontamento.MANUAL));
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, cardB, Instant.parse("2026-01-17T09:00:00Z"), Instant.parse("2026-01-17T09:15:00Z"), null, OrigemApontamento.MANUAL));
        // timer ainda aberto no mesmo período - não deve entrar na soma.
        apontamentoRepository.saveAndFlush(new Apontamento(usuario, cardB, Instant.parse("2026-01-18T09:00:00Z"), null, null, OrigemApontamento.TIMER));
        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/apontamentos?agrupar=card&inicio={inicio}&fim={fim}", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2)
                .jsonPath("$[0].cardId").isEqualTo(cardA.getId())
                .jsonPath("$[0].totalMinutos").isEqualTo(90)
                .jsonPath("$[1].cardId").isEqualTo(cardB.getId())
                .jsonPath("$[1].totalMinutos").isEqualTo(15);
    }

    @Test
    void gestorConsultaOTotalApontadoPorProjetoDeVerdade() {
        Usuario gestor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s55-gestor@escritor.io", Papel.GESTOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Projeto S55", "Cliente", StatusProjeto.ATIVO, java.time.LocalDate.now(), null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", projeto, null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Card A", null, 1024.0, null, null, null, gestor));
        apontamentoRepository.saveAndFlush(new Apontamento(
                gestor, card, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        String tokenGestor = jwtService.gerarAccessToken(gestor.getId(), Papel.GESTOR);

        client().get()
                .uri("/apontamentos/relatorio?projetoId={projetoId}&inicio={inicio}&fim={fim}", projeto.getId(), "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenGestor)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.totalMinutos").isEqualTo(60);
    }

    @Test
    void colaboradorTentandoConsultarRelatorioPorEquipeRecebe403DeVerdade() {
        Usuario colaborador = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s55-colaborador@escritor.io", Papel.COLABORADOR, 480));
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        String tokenColaborador = jwtService.gerarAccessToken(colaborador.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/apontamentos/relatorio?equipeId={equipeId}&inicio={inicio}&fim={fim}", equipe.getId(), "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")
                .header("Authorization", "Bearer " + tokenColaborador)
                .exchange()
                .expectStatus().isForbidden();
    }
}
