package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.LocalDate;
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

/**
 * IT de ponta a ponta de propósito, batendo os endpoints reais (POST /colunas/{id}/cards, PATCH
 * /cards/{id}/mover, GET /cards/{id}/eventos) - não chama {@code CardService} diretamente. Isso
 * é o que prova de verdade o enunciado de S3.17 ("mover um card gera o evento sozinho, dentro do
 * mesmo serviço que move"): o teste nunca cria um {@code CardEvento} manualmente, só observa que
 * ele aparece sozinho depois de criar/mover via HTTP.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CardEventoControllerIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private MembroProjetoRepository membroProjetoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    private static Projeto novoProjeto(String nome) {
        return new Projeto(nome, "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    }

    @Test
    void criarECardMoverGeramEventoSozinhosSemNenhumEndpointDeEventoSerChamado() {
        Usuario membro = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-evt@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, membro));
        Coluna colunaA = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Coluna colunaB = colunaRepository.saveAndFlush(new Coluna(projeto, "Em progresso", 1, null));
        String token = jwtService.gerarAccessToken(membro.getId(), Papel.COLABORADOR);

        Long cardId = client().post()
                .uri("/colunas/{id}/cards", colunaA.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"titulo":"Corrigir bug"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(CardResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        client().get()
                .uri("/cards/{id}/eventos", cardId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].tipo").isEqualTo("CRIACAO")
                .jsonPath("$[0].de").doesNotExist()
                .jsonPath("$[0].para").isEqualTo("A fazer");

        client().patch()
                .uri("/cards/{id}/mover", cardId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"colunaId":%d,"indice":0}
                        """
                        .formatted(colunaB.getId()))
                .exchange()
                .expectStatus().isOk();

        client().get()
                .uri("/cards/{id}/eventos", cardId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2)
                .jsonPath("$[1].tipo").isEqualTo("MUDANCA_COLUNA")
                .jsonPath("$[1].de").isEqualTo("A fazer")
                .jsonPath("$[1].para").isEqualTo("Em progresso")
                .jsonPath("$[1].autorId").isEqualTo(membro.getId());

        // reordenar dentro da mesma coluna (índice 0 na coluna onde já está) não é uma "mudança
        // de coluna" - não deve gerar um terceiro evento.
        client().patch()
                .uri("/cards/{id}/mover", cardId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"colunaId":%d,"indice":0}
                        """
                        .formatted(colunaB.getId()))
                .exchange()
                .expectStatus().isOk();

        client().get()
                .uri("/cards/{id}/eventos", cardId)
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2);
    }

    @Test
    void usuarioSemAcessoAoProjetoRecebe403AoListarEventos() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-evt2@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog Privado"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, dono));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        String tokenDono = jwtService.gerarAccessToken(dono.getId(), Papel.COLABORADOR);

        Long cardId = client().post()
                .uri("/colunas/{id}/cards", coluna.getId())
                .header("Authorization", "Bearer " + tokenDono)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"titulo":"Corrigir bug"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(CardResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        Usuario semAcesso = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-evt@escritor.io", Papel.COLABORADOR, 480));
        String tokenSemAcesso = jwtService.gerarAccessToken(semAcesso.getId(), Papel.COLABORADOR);

        client().get()
                .uri("/cards/{id}/eventos", cardId)
                .header("Authorization", "Bearer " + tokenSemAcesso)
                .exchange()
                .expectStatus().isForbidden();
    }

    /**
     * Auditoria de segurança (VULN-02, HIGH) - regressão do PoC ao vivo: antes desta correção,
     * {@code POST /colunas/{id}/cards} não checava nenhum vínculo do solicitante com o projeto
     * dono da coluna, então qualquer autenticado criava card em qualquer projeto do sistema.
     */
    @Test
    void criarCardEmColunaDeProjetoSemAcessoRetorna403() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-evt3@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog Privado 2"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, dono));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));

        Usuario semAcesso = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-evt2@escritor.io", Papel.COLABORADOR, 480));
        String tokenSemAcesso = jwtService.gerarAccessToken(semAcesso.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/colunas/{id}/cards", coluna.getId())
                .header("Authorization", "Bearer " + tokenSemAcesso)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"titulo":"Card indevido"}
                        """)
                .exchange()
                .expectStatus().isForbidden();
    }

    /**
     * Auditoria de segurança (VULN-02, HIGH) - regressão do PoC ao vivo desta auditoria: um
     * usuário SEM NENHUM vínculo com o "Projeto Confidencial" movia um card dele pra dentro do
     * próprio projeto (visível), lendo o título/descrição na resposta e fazendo o card aparecer
     * permanentemente no board errado. Confirmado ao vivo contra a instância local antes da
     * correção; este teste trava a regressão pra sempre.
     */
    @Test
    void moverCardDeProjetoSemAcessoRetorna403ENaoMudaNada() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-evt4@escritor.io", Papel.COLABORADOR, 480));
        Projeto projetoConfidencial = projetoRepository.saveAndFlush(novoProjeto("Projeto Confidencial"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoConfidencial, dono));
        Coluna colunaConfidencial = colunaRepository.saveAndFlush(new Coluna(projetoConfidencial, "A fazer", 0, null));
        String tokenDono = jwtService.gerarAccessToken(dono.getId(), Papel.COLABORADOR);
        Long cardId = client().post()
                .uri("/colunas/{id}/cards", colunaConfidencial.getId())
                .header("Authorization", "Bearer " + tokenDono)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"titulo":"Segredo do Projeto Confidencial"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(CardResponse.class)
                .returnResult()
                .getResponseBody()
                .id();

        Usuario forasteiro = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-evt3@escritor.io", Papel.COLABORADOR, 480));
        Projeto projetoDoForasteiro = projetoRepository.saveAndFlush(novoProjeto("Projeto do Beto"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoDoForasteiro, forasteiro));
        Coluna colunaDoForasteiro = colunaRepository.saveAndFlush(new Coluna(projetoDoForasteiro, "Recebidos", 0, null));
        String tokenForasteiro = jwtService.gerarAccessToken(forasteiro.getId(), Papel.COLABORADOR);

        client().patch()
                .uri("/cards/{id}/mover", cardId)
                .header("Authorization", "Bearer " + tokenForasteiro)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"colunaId":%d,"indice":0}
                        """
                        .formatted(colunaDoForasteiro.getId()))
                .exchange()
                .expectStatus().isForbidden();

        // o card continua exatamente onde estava, no projeto original
        client().get()
                .uri("/cards/{id}/eventos", cardId)
                .header("Authorization", "Bearer " + tokenDono)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].tipo").isEqualTo("CRIACAO");
    }
}
