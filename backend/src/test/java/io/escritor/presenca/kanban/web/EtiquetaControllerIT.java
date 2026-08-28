package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.EtiquetaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * IT (não WebMvcTest/mockito) de propósito: `deleteByCardAndEtiqueta` é um delete derivado do
 * Spring Data que só funciona dentro de uma transação de escrita de verdade - nem o teste de
 * serviço (repositório mockado) nem o `CardEtiquetaRepositoryIT` (roda dentro da transação
 * automática do `@DataJpaTest`) pegam a falta de `@Transactional` no método de serviço que a
 * chama fora desse contexto. Só um IT batendo `DELETE` de ponta a ponta, do jeito que o
 * `CardController` real recebe a chamada, reproduz o erro real
 * (`TransactionRequiredException: No EntityManager with actual transaction available`).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EtiquetaControllerIT {

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
    private EtiquetaRepository etiquetaRepository;

    @Autowired
    private CardEtiquetaRepository cardEtiquetaRepository;

    private RestTestClient restTestClient;

    private RestTestClient client() {
        if (restTestClient == null) {
            restTestClient = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        }
        return restTestClient;
    }

    @Test
    void removerEtiquetaDoCardPersisteDeVerdade() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-etq@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario));
        Etiqueta etiqueta = etiquetaRepository.saveAndFlush(new Etiqueta(quadro, "Urgente", "#FF0000"));
        cardEtiquetaRepository.saveAndFlush(new CardEtiqueta(card, etiqueta));

        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        client().delete()
                .uri("/cards/{cardId}/etiquetas/{etiquetaId}", card.getId(), etiqueta.getId())
                .header("Authorization", "Bearer " + token)
                .exchange()
                .expectStatus().isNoContent();

        assertThat(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).isFalse();
    }
}
