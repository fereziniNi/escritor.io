package io.escritor.presenca.kanban.ws;

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
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProjetoWebSocketBroadcastIT {

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
    void doisClientesConectadosAoMesmoProjetoRecebemOMovimentoDeCard() throws Exception {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-ws@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Board WS"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, usuario));
        Coluna origem = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Coluna destino = colunaRepository.saveAndFlush(new Coluna(projeto, "Em progresso", 1, null));
        Card card = cardRepository.saveAndFlush(new Card(origem, "Card WS", null, 1024.0, null, null, null, usuario));

        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        BlockingQueue<String> mensagens1 = new LinkedBlockingQueue<>();
        BlockingQueue<String> mensagens2 = new LinkedBlockingQueue<>();
        WebSocketSession sessao1 = conectar(projeto.getId(), token, mensagens1);
        WebSocketSession sessao2 = conectar(projeto.getId(), token, mensagens2);
        try {
            client().patch()
                    .uri("/cards/{id}/mover", card.getId())
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("""
                            {"colunaId":%d,"indice":0}
                            """
                            .formatted(destino.getId()))
                    .exchange()
                    .expectStatus().isOk();

            String recebido1 = mensagens1.poll(5, TimeUnit.SECONDS);
            String recebido2 = mensagens2.poll(5, TimeUnit.SECONDS);

            assertThat(recebido1).isNotNull().contains("\"colunaId\":" + destino.getId());
            assertThat(recebido2).isNotNull().contains("\"colunaId\":" + destino.getId());
        } finally {
            sessao1.close();
            sessao2.close();
        }
    }

    @Test
    void handshakeERecusadoParaUsuarioSemAcessoAoProjeto() {
        Usuario semAcesso = usuarioRepository.saveAndFlush(new Usuario("Bia Rocha", "bia-ws@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Board Privado"));
        String token = jwtService.gerarAccessToken(semAcesso.getId(), Papel.COLABORADOR);

        assertThatThrownBy(() -> conectar(projeto.getId(), token, new LinkedBlockingQueue<>()))
                .isInstanceOf(ExecutionException.class);
    }

    @Test
    void handshakeERecusadoSemToken() {
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Board Sem Token"));

        assertThatThrownBy(() -> {
            StandardWebSocketClient wsClient = new StandardWebSocketClient();
            wsClient.execute(new TextWebSocketHandler() {}, "ws://localhost:" + port + "/ws/projeto/" + projeto.getId())
                    .get(5, TimeUnit.SECONDS);
        }).isInstanceOf(ExecutionException.class);
    }

    private WebSocketSession conectar(Long projetoId, String token, BlockingQueue<String> mensagens)
            throws ExecutionException, InterruptedException, TimeoutException {
        StandardWebSocketClient wsClient = new StandardWebSocketClient();
        String uri = "ws://localhost:" + port + "/ws/projeto/" + projetoId + "?token=" + token;
        return wsClient
                .execute(
                        new TextWebSocketHandler() {
                            @Override
                            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                                mensagens.add(message.getPayload());
                            }
                        },
                        uri)
                .get(5, TimeUnit.SECONDS);
    }
}
