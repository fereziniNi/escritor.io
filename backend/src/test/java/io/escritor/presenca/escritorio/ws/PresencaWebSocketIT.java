package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * IT de ponta a ponta (S6.3): prova que conectar em {@code /ws/presenca} registra o usuário no
 * estado em memória e devolve um snapshot de verdade, e que desconectar remove o registro - não
 * um mock do handler, a stack WebSocket real (mesmo padrão de {@code
 * QuadroWebSocketBroadcastIT}, kanban S3.11).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PresencaWebSocketIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void conectarRegistraOUsuarioERecebeUmSnapshotDeSiMesmo() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s63@escritor.io", Papel.COLABORADOR, 480));
        String token = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagens = new LinkedBlockingQueue<>();

        WebSocketSession sessao = conectar(token, mensagens);
        try {
            String recebido = mensagens.poll(5, TimeUnit.SECONDS);

            assertThat(recebido).isNotNull().contains("\"tipo\":\"SNAPSHOT\"");
            assertThat(recebido)
                    .contains("\"usuarioId\":" + ana.getId())
                    .contains("\"nome\":\"Ana Souza\"")
                    .contains("\"x\":0")
                    .contains("\"y\":0")
                    .contains("\"status\":\"DISPONIVEL\"");
        } finally {
            sessao.close();
        }
    }

    @Test
    void segundoClienteConectadoVeAmbosOsUsuariosNoSnapshot() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s63b@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s63b@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                String recebidoBeto = mensagensBeto.poll(5, TimeUnit.SECONDS);

                assertThat(recebidoBeto).isNotNull().contains("\"usuarioId\":" + ana.getId()).contains("\"usuarioId\":" + beto.getId());
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void desconectarRemoveOUsuarioDoEstado() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s63c@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s63c@escritor.io", Papel.COLABORADOR, 480));
        Usuario caio = usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-s63c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);
        String tokenCaio = jwtService.gerarAccessToken(caio.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        WebSocketSession sessaoBeto = conectar(tokenBeto, new LinkedBlockingQueue<>());
        sessaoAna.close();
        // dá tempo do container processar o fechamento e chamar afterConnectionClosed antes do próximo connect
        Thread.sleep(500);

        BlockingQueue<String> mensagensCaio = new LinkedBlockingQueue<>();
        WebSocketSession sessaoCaio = conectar(tokenCaio, mensagensCaio);
        try {
            String recebidoCaio = mensagensCaio.poll(5, TimeUnit.SECONDS);

            assertThat(recebidoCaio)
                    .isNotNull()
                    .contains("\"usuarioId\":" + beto.getId())
                    .contains("\"usuarioId\":" + caio.getId())
                    .doesNotContain("\"usuarioId\":" + ana.getId());
        } finally {
            sessaoBeto.close();
            sessaoCaio.close();
        }
    }

    @Test
    void handshakeERecusadoSemToken() {
        assertThatThrownBy(() -> {
            StandardWebSocketClient wsClient = new StandardWebSocketClient();
            wsClient.execute(new TextWebSocketHandler() {}, "ws://localhost:" + port + "/ws/presenca").get(5, TimeUnit.SECONDS);
        }).isInstanceOf(ExecutionException.class);
    }

    private WebSocketSession conectar(String token, BlockingQueue<String> mensagens)
            throws ExecutionException, InterruptedException, TimeoutException {
        StandardWebSocketClient wsClient = new StandardWebSocketClient();
        String uri = "ws://localhost:" + port + "/ws/presenca?token=" + token;
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
