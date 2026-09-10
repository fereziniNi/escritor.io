package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.EventoPresenca;
import io.escritor.presenca.escritorio.repository.EventoPresencaRepository;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.EstiloBottom;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloJaqueta;
import io.escritor.presenca.identidade.domain.EstiloOutro;
import io.escritor.presenca.identidade.domain.EstiloSapato;
import io.escritor.presenca.identidade.domain.EstiloTop;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoCorpo;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.TipoRosto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
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
 * estado em memória e devolve um snapshot de verdade, e que desconectar estaciona o avatar como
 * {@code OFFLINE} em "Fora do trabalho" em vez de removê-lo do registro (pedido do usuário: "o
 * personagem fica em Fora do trabalho") - não um mock do handler, a stack WebSocket real (mesmo
 * padrão de {@code ProjetoWebSocketBroadcastIT}, kanban S3.11).
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

    @Autowired
    private PresencaWebSocketHandler presencaWebSocketHandler;

    @Autowired
    private EventoPresencaRepository eventoPresencaRepository;

    @BeforeEach
    void isolarEstadoEntreTestes() throws InterruptedException {
        // o bean do handler é singleton e o contexto é reaproveitado entre os testes desta classe;
        // o fechamento do WebSocket é assíncrono, então um `sessaoAna.close()` do teste anterior
        // pode disparar o broadcast de OFFLINE só agora - a pausa deixa esse `afterConnectionClosed`
        // pendente rodar antes de zerar o estado, pra ele não vazar pra fila do teste que vem.
        Thread.sleep(400);
        presencaWebSocketHandler.limparEstadoParaTeste();
    }

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
    void posicaoValidaEAceitaERebroadcastParaOsDemaisConectados() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s64a@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s64a@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                mensagensBeto.poll(5, TimeUnit.SECONDS); // snapshot inicial de quando Beto conectou, descartado

                sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":5,\"y\":5}"));

                String recebido = mensagensBeto.poll(5, TimeUnit.SECONDS);
                assertThat(recebido)
                        .isNotNull()
                        .contains("\"tipo\":\"POSICAO\"")
                        .contains("\"usuarioId\":" + ana.getId())
                        .contains("\"x\":5")
                        .contains("\"y\":5");
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void posicaoForaDosLimitesDoMapaERejeitadaENaoPropagada() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s64c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            // mapa seedado tem largura_tiles=36 (V51__centraliza_mapa_verticalmente.sql) - x=40 está fora
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":40,\"y\":5}"));
            Thread.sleep(500); // dá tempo do servidor processar (e rejeitar) a mensagem

            Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s64c@escritor.io", Papel.COLABORADOR, 480));
            String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                String snapshot = mensagensBeto.poll(5, TimeUnit.SECONDS);

                assertThat(snapshot).isNotNull().doesNotContain("\"x\":40");
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void trocarOProprioStatusEAceitoERebroadcastParaOsDemaisConectados() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s66a@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s66a@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                mensagensBeto.poll(5, TimeUnit.SECONDS); // snapshot inicial de quando Beto conectou, descartado

                sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"STATUS\",\"status\":\"FOCO\"}"));

                String recebido = mensagensBeto.poll(5, TimeUnit.SECONDS);
                assertThat(recebido)
                        .isNotNull()
                        .contains("\"tipo\":\"STATUS\"")
                        .contains("\"usuarioId\":" + ana.getId())
                        .contains("\"status\":\"FOCO\"");
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void naoExisteJeitoDoClienteAlterarOStatusDeOutroUsuario() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s66b@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s66b@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                mensagensBeto.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

                // "usuarioId" extra no payload é ignorado - ComandoWs nem tem esse campo, a
                // identidade de quem manda vem sempre da sessão autenticada no handshake
                sessaoAna.sendMessage(
                        new TextMessage("{\"tipo\":\"STATUS\",\"status\":\"FOCO\",\"usuarioId\":" + beto.getId() + "}"));

                String recebido = mensagensBeto.poll(5, TimeUnit.SECONDS);
                assertThat(recebido).isNotNull().contains("\"usuarioId\":" + ana.getId()).doesNotContain("\"usuarioId\":" + beto.getId());
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void statusDesconhecidoERejeitadoENaoPropagado() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s66c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"STATUS\",\"status\":\"NAO_EXISTE\"}"));
            Thread.sleep(500); // dá tempo do servidor processar (e rejeitar) a mensagem

            Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s66c@escritor.io", Papel.COLABORADOR, 480));
            String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                String snapshot = mensagensBeto.poll(5, TimeUnit.SECONDS);

                assertThat(snapshot).isNotNull().doesNotContain("\"status\":\"NAO_EXISTE\"").contains("\"status\":\"DISPONIVEL\"");
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    /**
     * A aparência do snapshot vem de verdade do banco (`usuario.getAparencia()`, carregado no
     * handshake) - não é hardcoded no handler. `AparenciaAvatar.padrao()` (ver `Usuario.java`) é o
     * valor de quem nunca personalizou nada, então isso também prova que `Usuario` nasce com uma
     * aparência válida sem precisar de nenhum passo extra.
     */
    @Test
    void snapshotInicialTrazAAparenciaCadastradaDoUsuario() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-aparencia-snapshot@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            String recebido = mensagensAna.poll(5, TimeUnit.SECONDS);

            assertThat(recebido).isNotNull().contains("\"estiloCabelo\":\"CURTO\"").contains("\"tipoBarba\":\"NENHUM\"");
        } finally {
            sessaoAna.close();
        }
    }

    /**
     * Pedido do usuário: "a opção para todos detalhar da melhor maneira possível o avatar" - prova
     * que {@link PresencaWebSocketHandler#atualizarAparencia} (chamado por {@code
     * UsuarioService#atualizarMinhaAparencia} depois de um `PATCH /usuarios/me/aparencia` de
     * verdade) chega pra quem já está conectado no mapa, sem precisar reconectar.
     */
    @Test
    void atualizarAparenciaEnquantoConectadoRebroadcastParaOsDemaisSemPrecisarReconectar() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-aparencia-live@escritor.io", Papel.COLABORADOR, 480));
        Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-aparencia-live@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);

        WebSocketSession sessaoAna = conectar(tokenAna, new LinkedBlockingQueue<>());
        try {
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                mensagensBeto.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

                AparenciaAvatar aparenciaNova = new AparenciaAvatar(
                        "#8a5a34", TipoCorpo.FEMININO, TipoRosto.MAGRA, EstiloCabelo.LONGO, "#1c1a28", TipoBarba.BARBA_CHEIA,
                        EstiloTop.SUETER, "#e0546f", EstiloJaqueta.CASACO_LONGO, "#1c1a28",
                        EstiloBottom.SAIA, "#e0546f", EstiloSapato.BOTA_CANO_ALTO, "#1c1a28",
                        TipoChapeu.GORRO, "#c0392b", TipoOculos.QUADRADO, "#1c1a28", EstiloOutro.LENCO, "#e874c4");
                presencaWebSocketHandler.atualizarAparencia(ana.getId(), aparenciaNova);

                String recebido = mensagensBeto.poll(5, TimeUnit.SECONDS);
                assertThat(recebido)
                        .isNotNull()
                        .contains("\"usuarioId\":" + ana.getId())
                        .contains("\"tipoBarba\":\"BARBA_CHEIA\"");
            } finally {
                sessaoBeto.close();
            }
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void entrarNumaZonaFocoAtualizaOStatusAutomaticamente() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s67a@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);

            // zona "Área de trabalho" (tipo FOCO), pós V50/V51: x em [7,19) e y em [15,23)
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}"));

            String recebido = proximaMensagemDe(mensagensAna, ana.getId());
            assertThat(recebido).isNotNull().contains("\"status\":\"FOCO\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void sairDaZonaSemTrocaManualRestauraOStatusDeAntesDeEntrar() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s67b@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}")); // entra na Área de trabalho (FOCO)
            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"FOCO\"");

            // (20,13) fica no corredor horizontal aberto entre a fileira de cima (salas em y 6-11)
            // e a de baixo (Área de trabalho/Fora do trabalho em y 15-22) - fora de toda zona
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":20,\"y\":13}"));

            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"DISPONIVEL\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void statusTrocadoManualmenteDentroDaZonaSobreviveASaida() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s67c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}")); // entra na Área de trabalho (FOCO)
            proximaMensagemDe(mensagensAna, ana.getId());

            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"STATUS\",\"status\":\"ALMOCO\"}")); // troca manual, ainda dentro da zona
            proximaMensagemDe(mensagensAna, ana.getId());

            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":20,\"y\":13}")); // sai da zona pro espaço aberto

            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"ALMOCO\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void entrarEmQualquerZonaAtualizaOStatus() throws Exception {
        // pedido do usuário: "independente de qual sala seja, atualize o status" - antes só FOCO/
        // REUNIAO mudavam o status; Café/Fora do trabalho/Cabine agora também mudam.
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s67d@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);

            // "Café" (tipo CAFE), pós V50/V51: x em [19,25) e y em [6,12) -> ALMOCO
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":21,\"y\":8}"));
            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"ALMOCO\"");

            // "Fora do trabalho" (tipo LIVRE): x em [22,32) e y em [15,23) -> AUSENTE
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":25,\"y\":18}"));
            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"AUSENTE\"");

            // "Cabine 1" (tipo CABINE): x em [1,4) e y em [6,9) -> FOCO
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":7}"));
            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"FOCO\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void usuarioInativoPorCincoMinutosRecebeStatusAusenteDeVerdade() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s68a@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);

            // chama a varredura direto, sem esperar 5 minutos de verdade nem o @Scheduled real -
            // "agora" simulado já passou do limiar de inatividade (PRD)
            presencaWebSocketHandler.verificarInatividade(Instant.now().plus(Duration.ofMinutes(6)));

            String recebido = proximaMensagemDe(mensagensAna, ana.getId());
            assertThat(recebido).isNotNull().contains("\"tipo\":\"STATUS\"").contains("\"status\":\"AUSENTE\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void usuarioAindaAtivoNaoRecebeStatusAusente() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s68b@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);

            // "agora" simulado é só um instante depois de conectar - bem abaixo do limiar de 5 min
            presencaWebSocketHandler.verificarInatividade(Instant.now());

            assertThat(proximaMensagemDe(mensagensAna, ana.getId(), 2000)).isNull();
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void qualquerMensagemNovaTiraOUsuarioDoAusenteAutomatico() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s68c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            aguardarSnapshot(mensagensAna);
            presencaWebSocketHandler.verificarInatividade(Instant.now().plus(Duration.ofMinutes(6)));
            assertThat(proximaMensagemDe(mensagensAna, ana.getId())).isNotNull().contains("\"status\":\"AUSENTE\"");

            // (20,13) fica no corredor aberto, fora de toda zona - qualquer mensagem nova já tira do AUSENTE
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":20,\"y\":13}"));

            String recuperado = proximaMensagemDe(mensagensAna, ana.getId());
            assertThat(recuperado).isNotNull().contains("\"status\":\"DISPONIVEL\"").doesNotContain("\"status\":\"AUSENTE\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void entrarNumaZonaGravaUmEventoDePresencaAberto() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s612a@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

            // zona "Área de trabalho" (tipo FOCO), pós V50/V51: x em [7,19) e y em [15,23)
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}"));
            String recebido = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(recebido).isNotNull(); // o broadcast já saiu antes da escrita do evento (PRD, S6.12)
            // receber o broadcast no cliente não prova que a escrita seguinte no servidor (mesma
            // thread, mas depois do send) já terminou - entrega de rede e o resto do método do
            // servidor correm em paralelo, então ainda precisa de uma margem aqui
            Thread.sleep(300);

            List<EventoPresenca> eventos = eventoPresencaRepository.findByUsuarioId(ana.getId());
            assertThat(eventos).hasSize(1);
            assertThat(eventos.get(0).getUsuario().getId()).isEqualTo(ana.getId());
            assertThat(eventos.get(0).getZona().getNome()).isEqualTo("Área de trabalho");
            assertThat(eventos.get(0).getEntrouEm()).isNotNull();
            assertThat(eventos.get(0).getSaiuEm()).isNull();
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void sairDeUmaZonaEncerraOEventoDePresencaAberto() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s612b@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}")); // entra na Área de trabalho (FOCO)
            mensagensAna.poll(5, TimeUnit.SECONDS);

            // (20,13) fica no corredor aberto, fora de toda zona
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":20,\"y\":13}"));
            mensagensAna.poll(5, TimeUnit.SECONDS);
            Thread.sleep(300); // receber o broadcast não prova que a escrita seguinte já terminou

            List<EventoPresenca> eventos = eventoPresencaRepository.findByUsuarioId(ana.getId());
            assertThat(eventos).hasSize(1);
            assertThat(eventos.get(0).getSaiuEm()).isNotNull();
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void andarDiretoDeUmaZonaPraOutraEncerraAAntigaEAbreANova() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s612c@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}")); // entra na Área de trabalho (FOCO)
            mensagensAna.poll(5, TimeUnit.SECONDS);

            // zona "Sala de reunião" (tipo REUNIAO), pós V50/V51: x em [7,14) e y em [6,12) - não é
            // fisicamente adjacente à Área de trabalho no layout, mas não há checagem de velocidade/
            // teleporte no servidor (ValidadorPosicaoMapa só valida limites do mapa), então uma única
            // mensagem POSICAO "pulando" direto pra dentro da outra zona ainda é o cenário válido aqui.
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":8}"));
            mensagensAna.poll(5, TimeUnit.SECONDS);
            Thread.sleep(300); // receber o broadcast não prova que a escrita seguinte já terminou

            List<EventoPresenca> eventos = eventoPresencaRepository.findByUsuarioId(ana.getId());
            assertThat(eventos).hasSize(2);
            EventoPresenca eventoFoco = eventos.stream().filter(e -> e.getZona().getNome().equals("Área de trabalho")).findFirst().orElseThrow();
            EventoPresenca eventoReuniao =
                    eventos.stream().filter(e -> e.getZona().getNome().equals("Sala de reunião")).findFirst().orElseThrow();
            assertThat(eventoFoco.getSaiuEm()).isNotNull();
            assertThat(eventoReuniao.getSaiuEm()).isNull();
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void desconectarComZonaAbertaEncerraOEventoDePresenca() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s612d@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":10,\"y\":16}")); // entra na Área de trabalho (FOCO)
        mensagensAna.poll(5, TimeUnit.SECONDS);

        sessaoAna.close();
        Thread.sleep(500); // dá tempo do container processar o fechamento e afterConnectionClosed rodar

        List<EventoPresenca> eventos = eventoPresencaRepository.findByUsuarioId(ana.getId());
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).getSaiuEm()).isNotNull();
    }

    @Test
    void desconectarEstacionaOUsuarioComoOfflineEmForaDoTrabalhoEmVezDeRemover() throws Exception {
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

            // Ana continua no snapshot (não some) - só que agora OFFLINE e estacionada no centro
            // de "Fora do trabalho" (pós V50/V51: x=22,y=15,largura=10,altura=8 -> centro 27,19)
            assertThat(recebidoCaio)
                    .isNotNull()
                    .contains("\"usuarioId\":" + beto.getId())
                    .contains("\"usuarioId\":" + caio.getId())
                    .contains("\"usuarioId\":" + ana.getId())
                    .contains("\"status\":\"OFFLINE\"")
                    .contains("\"x\":27")
                    .contains("\"y\":19");
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

    /**
     * Espera a próxima mensagem de POSICAO/STATUS sobre {@code usuarioId} (pula o SNAPSHOT inicial
     * e broadcasts sobre outros usuários). O {@code PresencaWebSocketIT} reaproveita o mesmo bean
     * do handler entre os testes da classe e o fechamento do WebSocket é assíncrono, então um
     * broadcast de OFFLINE de um {@code close()} de um teste anterior pode chegar tarde na fila
     * deste teste - filtrar por usuário deixa a asserção robusta a esse ruído em vez de flaky.
     */
    /**
     * Bloqueia até o SNAPSHOT inicial chegar - serve de barreira de sincronização (garante que o
     * {@code afterConnectionEstablished} do servidor já rodou e registrou o usuário no estado)
     * antes do teste mandar POSICAO/STATUS ou chamar {@code verificarInatividade}.
     */
    private void aguardarSnapshot(BlockingQueue<String> mensagens) throws InterruptedException {
        long fim = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < fim) {
            String msg = mensagens.poll(Math.max(0, fim - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
            if (msg != null && msg.contains("\"tipo\":\"SNAPSHOT\"")) {
                return;
            }
        }
    }

    private String proximaMensagemDe(BlockingQueue<String> mensagens, long usuarioId) throws InterruptedException {
        return proximaMensagemDe(mensagens, usuarioId, 5000);
    }

    private String proximaMensagemDe(BlockingQueue<String> mensagens, long usuarioId, long timeoutMs) throws InterruptedException {
        long fim = System.currentTimeMillis() + timeoutMs;
        String alvo = "\"usuarioId\":" + usuarioId + ",";
        while (System.currentTimeMillis() < fim) {
            String msg = mensagens.poll(Math.max(0, fim - System.currentTimeMillis()), TimeUnit.MILLISECONDS);
            if (msg != null && !msg.contains("\"tipo\":\"SNAPSHOT\"") && msg.contains(alvo)) {
                return msg;
            }
        }
        return null;
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
