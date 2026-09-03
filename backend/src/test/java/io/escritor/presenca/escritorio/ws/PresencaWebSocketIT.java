package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.EventoPresenca;
import io.escritor.presenca.escritorio.repository.EventoPresencaRepository;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloRoupa;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
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
            // mapa seedado por V24__redesenha_salas_por_funcao.sql tem largura_tiles=28 - x=30 está fora
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":30,\"y\":5}"));
            Thread.sleep(500); // dá tempo do servidor processar (e rejeitar) a mensagem

            Usuario beto = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-s64c@escritor.io", Papel.COLABORADOR, 480));
            String tokenBeto = jwtService.gerarAccessToken(beto.getId(), Papel.COLABORADOR);
            BlockingQueue<String> mensagensBeto = new LinkedBlockingQueue<>();
            WebSocketSession sessaoBeto = conectar(tokenBeto, mensagensBeto);
            try {
                String snapshot = mensagensBeto.poll(5, TimeUnit.SECONDS);

                assertThat(snapshot).isNotNull().doesNotContain("\"x\":30");
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

            assertThat(recebido)
                    .isNotNull()
                    .contains("\"corPele\":\"#f2c9a0\"")
                    .contains("\"estiloCabelo\":\"CURTO\"")
                    .contains("\"estiloRoupa\":\"CAMISETA\"")
                    .contains("\"oculos\":\"NENHUM\"")
                    .contains("\"chapeu\":\"NENHUM\"");
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

                AparenciaAvatar novaAparencia =
                        new AparenciaAvatar("#8a5a34", EstiloCabelo.LONGO, "#c9a24a", EstiloRoupa.JAQUETA, "#4472c4", TipoOculos.QUADRADO, TipoChapeu.GORRO);
                presencaWebSocketHandler.atualizarAparencia(ana.getId(), novaAparencia);

                String recebido = mensagensBeto.poll(5, TimeUnit.SECONDS);
                assertThat(recebido)
                        .isNotNull()
                        .contains("\"usuarioId\":" + ana.getId())
                        .contains("\"estiloCabelo\":\"LONGO\"")
                        .contains("\"estiloRoupa\":\"JAQUETA\"")
                        .contains("\"corRoupa\":\"#4472c4\"")
                        .contains("\"oculos\":\"QUADRADO\"")
                        .contains("\"chapeu\":\"GORRO\"");
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

            // zona "Área de trabalho" (tipo FOCO) seedada por V24__redesenha_salas_por_funcao.sql cobre x em [1,13) e y em [10,18)
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}"));

            String recebido = mensagensAna.poll(5, TimeUnit.SECONDS);
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}")); // entra na Área de trabalho (FOCO)
            String dentro = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(dentro).isNotNull().contains("\"status\":\"FOCO\"");

            // (8,8) não cai em nenhuma zona seedada (V24: reuniões/café ficam em y 1-6, área de
            // trabalho/fora do trabalho em y 10-17 - (8,8) fica no corredor aberto entre elas)
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":8,\"y\":8}"));

            String fora = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(fora).isNotNull().contains("\"status\":\"DISPONIVEL\"");
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}")); // entra na Área de trabalho (FOCO)
            mensagensAna.poll(5, TimeUnit.SECONDS);

            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"STATUS\",\"status\":\"ALMOCO\"}")); // troca manual, ainda dentro da zona
            mensagensAna.poll(5, TimeUnit.SECONDS);

            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":8,\"y\":8}")); // sai da zona pro espaço aberto

            String fora = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(fora).isNotNull().contains("\"status\":\"ALMOCO\"");
        } finally {
            sessaoAna.close();
        }
    }

    @Test
    void entrarNumaZonaSemStatusCorrespondenteNaoMudaOStatus() throws Exception {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-s67d@escritor.io", Papel.COLABORADOR, 480));
        String tokenAna = jwtService.gerarAccessToken(ana.getId(), Papel.COLABORADOR);
        BlockingQueue<String> mensagensAna = new LinkedBlockingQueue<>();

        WebSocketSession sessaoAna = conectar(tokenAna, mensagensAna);
        try {
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

            // zona "Café" seedada por V24__redesenha_salas_por_funcao.sql cobre x em [13,19) e y em [1,7) - sem StatusAvatar.CAFE
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":15,\"y\":2}"));

            String recebido = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(recebido).isNotNull().contains("\"status\":\"DISPONIVEL\"");
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

            // chama a varredura direto, sem esperar 5 minutos de verdade nem o @Scheduled real -
            // "agora" simulado já passou do limiar de inatividade (PRD)
            presencaWebSocketHandler.verificarInatividade(Instant.now().plus(Duration.ofMinutes(6)));

            String recebido = mensagensAna.poll(5, TimeUnit.SECONDS);
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado

            // "agora" simulado é só um instante depois de conectar - bem abaixo do limiar de 5 min
            presencaWebSocketHandler.verificarInatividade(Instant.now());

            String recebido = mensagensAna.poll(2, TimeUnit.SECONDS);
            assertThat(recebido).isNull();
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
            mensagensAna.poll(5, TimeUnit.SECONDS); // snapshot inicial, descartado
            presencaWebSocketHandler.verificarInatividade(Instant.now().plus(Duration.ofMinutes(6)));
            String ausente = mensagensAna.poll(5, TimeUnit.SECONDS);
            assertThat(ausente).isNotNull().contains("\"status\":\"AUSENTE\"");

            // (8,8) não cai em nenhuma zona seedada - qualquer mensagem nova já tira do AUSENTE
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":8,\"y\":8}"));

            String recuperado = mensagensAna.poll(5, TimeUnit.SECONDS);
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

            // zona "Área de trabalho" (tipo FOCO) seedada por V24__redesenha_salas_por_funcao.sql cobre x em [1,13) e y em [10,18)
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}"));
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
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}")); // entra na Área de trabalho (FOCO)
            mensagensAna.poll(5, TimeUnit.SECONDS);

            // (8,8) não cai em nenhuma zona seedada
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":8,\"y\":8}"));
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
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}")); // entra na Área de trabalho (FOCO)
            mensagensAna.poll(5, TimeUnit.SECONDS);

            // zona "Sala de reunião" seedada por V24__redesenha_salas_por_funcao.sql cobre x em [1,8) e y em [1,7) -
            // não é fisicamente adjacente à Área de trabalho no layout novo, mas não há checagem de velocidade/
            // teleporte no servidor (ValidadorPosicaoMapa só valida limites do mapa), então uma única mensagem
            // POSICAO "pulando" direto pra dentro da outra zona ainda é o cenário válido que este teste quer cobrir.
            sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":2}"));
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
        sessaoAna.sendMessage(new TextMessage("{\"tipo\":\"POSICAO\",\"x\":2,\"y\":11}")); // entra na Área de trabalho (FOCO)
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
            // de "Fora do trabalho" (V24: x=16,y=10,largura=10,altura=8 -> centro 21,14)
            assertThat(recebidoCaio)
                    .isNotNull()
                    .contains("\"usuarioId\":" + beto.getId())
                    .contains("\"usuarioId\":" + caio.getId())
                    .contains("\"usuarioId\":" + ana.getId())
                    .contains("\"status\":\"OFFLINE\"")
                    .contains("\"x\":21")
                    .contains("\"y\":14");
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
