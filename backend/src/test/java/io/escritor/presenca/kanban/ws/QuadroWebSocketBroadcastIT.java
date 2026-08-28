package io.escritor.presenca.kanban.ws;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.seguranca.JwtService;
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
class QuadroWebSocketBroadcastIT {

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
    private MembroEquipeRepository membroEquipeRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private QuadroRepository quadroRepository;

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

    @Test
    void doisClientesConectadosAoMesmoQuadroRecebemOMovimentoDeCard() throws Exception {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-ws@escritor.io", Papel.COLABORADOR, 480));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, usuario, PapelNaEquipe.MEMBRO));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Board WS", null, equipe));
        Coluna origem = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Coluna destino = colunaRepository.saveAndFlush(new Coluna(quadro, "Em progresso", 1, null));
        Card card = cardRepository.saveAndFlush(new Card(origem, "Card WS", null, 1024.0, null, null, null, usuario));

        String token = jwtService.gerarAccessToken(usuario.getId(), Papel.COLABORADOR);

        BlockingQueue<String> mensagens1 = new LinkedBlockingQueue<>();
        BlockingQueue<String> mensagens2 = new LinkedBlockingQueue<>();
        WebSocketSession sessao1 = conectar(quadro.getId(), token, mensagens1);
        WebSocketSession sessao2 = conectar(quadro.getId(), token, mensagens2);
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
    void handshakeERecusadoParaUsuarioSemAcessoAoQuadro() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Financeiro", null));
        Usuario semAcesso = usuarioRepository.saveAndFlush(new Usuario("Bia Rocha", "bia-ws@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Board Privado", null, equipe));
        String token = jwtService.gerarAccessToken(semAcesso.getId(), Papel.COLABORADOR);

        assertThatThrownBy(() -> conectar(quadro.getId(), token, new LinkedBlockingQueue<>()))
                .isInstanceOf(ExecutionException.class);
    }

    @Test
    void handshakeERecusadoSemToken() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Board Sem Token", null, equipe));

        assertThatThrownBy(() -> {
            StandardWebSocketClient wsClient = new StandardWebSocketClient();
            wsClient.execute(new TextWebSocketHandler() {}, "ws://localhost:" + port + "/ws/quadro/" + quadro.getId())
                    .get(5, TimeUnit.SECONDS);
        }).isInstanceOf(ExecutionException.class);
    }

    private WebSocketSession conectar(Long quadroId, String token, BlockingQueue<String> mensagens)
            throws ExecutionException, InterruptedException, TimeoutException {
        StandardWebSocketClient wsClient = new StandardWebSocketClient();
        String uri = "ws://localhost:" + port + "/ws/quadro/" + quadroId + "?token=" + token;
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
