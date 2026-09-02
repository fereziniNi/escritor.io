package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.CardRepository;
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
 * IT de ponta a ponta (não WebMvcTest/mockito) de propósito: a regra de acesso de S3.15 depende
 * de {@code ProjetoService.usuarioPodeVer}, que por sua vez depende de consultas reais de membro
 * de projeto - só um teste com Spring/Postgres de verdade prova que um usuário sem atribuição ao
 * projeto (pedido do cliente: atribuição individual, sem Equipe/Quadro separado) recebe 403 de verdade, não
 * um mock ensinado a devolver isso.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CardComentarioControllerIT {

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

    @Autowired
    private CardRepository cardRepository;

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
    void membroDoProjetoComentaEListaComSucesso() {
        Usuario membro = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-com@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, membro));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, membro));
        String token = jwtService.gerarAccessToken(membro.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/comentarios", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"texto":"Já revisei, parece ok"}
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.texto").isEqualTo("Já revisei, parece ok")
                .jsonPath("$.autorId").isEqualTo(membro.getId());

        client().get()
                .uri("/cards/{id}/comentarios", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$[0].texto").isEqualTo("Já revisei, parece ok");
    }

    @Test
    void usuarioSemAcessoAoProjetoRecebe403AoComentar() {
        Usuario dono = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-com2@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog Privado"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, dono));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, dono));
        Usuario semAcesso = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-com@escritor.io", Papel.COLABORADOR, 480));
        String token = jwtService.gerarAccessToken(semAcesso.getId(), Papel.COLABORADOR);

        client().post()
                .uri("/cards/{id}/comentarios", card.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"texto":"Tentando comentar sem acesso"}
                        """)
                .exchange()
                .expectStatus().isForbidden();

        client().get()
                .uri("/cards/{id}/comentarios", card.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isForbidden();
    }
}
