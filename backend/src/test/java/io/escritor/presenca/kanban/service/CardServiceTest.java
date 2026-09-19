package io.escritor.presenca.kanban.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.CalculadoraPosicao;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.domain.TituloCardObrigatorioException;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.ws.ProjetoWebSocketHandler;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import io.escritor.presenca.ponto.notificacao.EnvioWhatsApp;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CardServiceTest {

    @Mock
    private CardRepository cardRepository;

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ProjetoWebSocketHandler projetoWebSocketHandler;

    @Mock
    private CardEventoRepository cardEventoRepository;

    @Mock
    private PresencaWebSocketHandler presencaWebSocketHandler;

    @Mock
    private NotificacaoService notificacaoService;

    @Mock
    private ProjetoService projetoService;

    @Mock
    private EnvioWhatsApp envioWhatsApp;

    private final Coluna coluna = colunaComId(1L);
    private final Usuario criadoPor = usuarioComId(1L);

    private CardService service;

    private static Coluna colunaComId(Long id) {
        return colunaComId(id, null);
    }

    private static Coluna colunaComId(Long id, Integer limiteWip) {
        return colunaComId(id, limiteWip, 100L);
    }

    /** {@code idProjeto} tem um valor default fixo (100L) em vez de derivado de {@code id} de
     * propósito: a maioria dos testes desta classe não liga pra qual projeto é, só quer duas
     * colunas quaisquer - dar o MESMO id de projeto por padrão é o que faz `service.mover` (com a
     * checagem de "mesmo projeto" de VULN-02) não recusar esses cenários por acidente. Só o teste
     * que prova a rejeição entre projetos passa um id diferente explicitamente. */
    private static Coluna colunaComId(Long id, Integer limiteWip, Long idProjeto) {
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", idProjeto);
        Coluna coluna = new Coluna(projeto, "A fazer", 0, limiteWip);
        ReflectionTestUtils.setField(coluna, "id", id);
        return coluna;
    }

    /** Pra testar a heurística de "última coluna do projeto" (ver {@code
     * CardService#avisarSeFinalizouATarefa}) - precisa de duas colunas de VERDADE do mesmo
     * projeto (`colunaComId` sozinho cria um `Projeto` novo a cada chamada). */
    private static Coluna outraColunaMesmoProjeto(Coluna referencia, Long id, String nome) {
        Coluna coluna = new Coluna(referencia.getProjeto(), nome, 1, null);
        ReflectionTestUtils.setField(coluna, "id", id);
        return coluna;
    }

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    /** Pedido do usuário: avisar o admin por WhatsApp ao criar/mover uma tarefa - precisa de um
     * usuário com papel ADMIN de verdade (diferente de {@link #usuarioComId}, sempre
     * COLABORADOR), com nome próprio pra distinguir de outros admins nos testes com mais de um. */
    private static Usuario adminComId(Long id, String nome) {
        Usuario admin = new Usuario(nome, "admin" + id + "@escritor.io", Papel.ADMIN, 480);
        ReflectionTestUtils.setField(admin, "id", id);
        return admin;
    }

    private Card cardComId(Long id, Coluna colunaDoCard, double posicao) {
        Card card = new Card(colunaDoCard, "Card " + id, null, posicao, null, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new CardService(
                cardRepository, colunaRepository, usuarioRepository, projetoWebSocketHandler, cardEventoRepository,
                presencaWebSocketHandler, notificacaoService, projetoService, envioWhatsApp);
        // Auditoria de segurança (VULN-02): default permissivo pra não obrigar toda fatia deste
        // arquivo (nenhuma delas testa autorização, testam posição/WIP/eventos/notificação) a
        // stubar `usuarioPodeVer` na mão - os testes dedicados de acesso abaixo sobrescrevem isto.
        lenient().when(projetoService.usuarioPodeVer(any(), any())).thenReturn(true);
    }

    @Test
    void criaPrimeiroCardDaColunaComPosicaoBase() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        assertThat(resposta.titulo()).isEqualTo("Corrigir bug");
        assertThat(resposta.posicao()).isEqualTo(1024.0);
        assertThat(resposta.criadoPorId()).isEqualTo(1L);
    }

    @Test
    void criaSegundoCardDepoisDoUltimo() {
        Card cardExistente = new Card(coluna, "Já existente", null, 1024.0, null, null, null, criadoPor);
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.of(cardExistente));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        assertThat(resposta.posicao()).isGreaterThan(1024.0);
    }

    @Test
    void criaComResponsavelExistente() {
        Usuario responsavel = usuarioComId(2L);
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(responsavel));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "Corrigir bug", null, 2L, null, null, criadoPor);

        assertThat(resposta.responsavelId()).isEqualTo(2L);
    }

    @Test
    void criarComResponsavelInexistenteLancaRecursoNaoEncontrado() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(1L, "Corrigir bug", null, 999L, null, null, criadoPor))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(cardRepository, never()).save(any());
    }

    @Test
    void criarEmColunaInexistenteLancaRecursoNaoEncontrado() {
        when(colunaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99L, "Corrigir bug", null, null, null, null, criadoPor))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void criarSemTituloLancaExcecaoSemSalvar() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(1L, "   ", null, null, null, null, criadoPor))
                .isInstanceOf(TituloCardObrigatorioException.class);

        verify(cardRepository, never()).save(any());
    }

    @Test
    void criarGeraEventoDeCriacao() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        var captor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(captor.capture());
        assertThat(captor.getValue().getTipo()).isEqualTo(TipoEventoCard.CRIACAO);
        assertThat(captor.getValue().getDe()).isNull();
        assertThat(captor.getValue().getPara()).isEqualTo("A fazer");
        assertThat(captor.getValue().getAutor()).isSameAs(criadoPor);
    }

    @Test
    void criarAvisaTodoMundoDeUmaTarefaNovaExcetoQuemCriou() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        var captor = ArgumentCaptor.forClass(PresencaWebSocketHandler.NovaTarefaWs.class);
        verify(presencaWebSocketHandler).avisarNovaTarefa(eq(criadoPor.getId()), captor.capture());
        assertThat(captor.getValue().cardTitulo()).isEqualTo("Corrigir bug");
        assertThat(captor.getValue().projetoNome()).isEqualTo(coluna.getProjeto().getNome());
        assertThat(captor.getValue().autorNome()).isEqualTo(criadoPor.getNome());
    }

    @Test
    void criarNotificaTodosOsUsuariosAtivosExcetoQuemCriou() {
        Usuario outro = usuarioComId(2L);
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        // mesmo escopo "todos os usuários do sistema" do broadcast em tempo real, mas persistido -
        // pedido do usuário: "ver as últimas que chegaram no sistema" funciona mesmo offline.
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(criadoPor, outro));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        verify(notificacaoService).registrar(eq(outro), eq(TipoNotificacao.NOVA_TAREFA), any(), isNull());
        verify(notificacaoService, never()).registrar(eq(criadoPor), any(), any(), any());
    }

    // ---------- pedido do usuário: avisar o admin por WhatsApp ao criar/mover uma tarefa ----------

    @Test
    void criarAvisaOAdminPorWhatsappQuandoEleTemNumeroCadastrado() {
        Usuario admin = adminComId(20L, "Admin Geral");
        admin.alterarWhatsapp("5511977776666");
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(admin));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        verify(envioWhatsApp).enviar(eq("5511977776666"), any());
    }

    @Test
    void criarNaoQuebraQuandoAdminNaoTemWhatsappCadastrado() {
        Usuario admin = adminComId(20L, "Admin Geral"); // sem alterarWhatsapp - continua sem número
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(admin));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        verify(envioWhatsApp, never()).enviar(any(), any());
    }

    @Test
    void criarNaoAvisaOAdminQuandoEleMesmoCriouATarefa() {
        Usuario adminQueCriou = adminComId(20L, "Admin Geral");
        adminQueCriou.alterarWhatsapp("5511977776666");
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(adminQueCriou));

        service.criar(1L, "Corrigir bug", null, null, null, null, adminQueCriou);

        verify(envioWhatsApp, never()).enviar(any(), any());
    }

    /** Diferente de {@code avisarSeFinalizouATarefa} (só na ÚLTIMA coluna) - o admin acompanha
     * QUALQUER mudança de status, inclusive indo pra uma coluna do meio ou voltando pra trás
     * ("de feito para fazendo", pedido do usuário). */
    @Test
    void moverParaQualquerColunaAvisaOAdminPorWhatsappMesmoNaoSendoAUltima() {
        Coluna destino = colunaComId(2L);
        Coluna ultimaColuna = outraColunaMesmoProjeto(destino, 3L, "Concluído");
        Usuario admin = adminComId(20L, "Admin Geral");
        admin.alterarWhatsapp("5511977776666");
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(destino, ultimaColuna));
        when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(admin));

        service.mover(10L, 2L, 0, criadoPor);

        verify(envioWhatsApp).enviar(eq("5511977776666"), any());
    }

    @Test
    void moverNaoAvisaOAdminQuandoEleMesmoMoveuOCard() {
        Coluna destino = colunaComId(2L);
        Usuario adminQueMoveu = adminComId(20L, "Admin Geral");
        adminQueMoveu.alterarWhatsapp("5511977776666");
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(coluna, destino));
        when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(adminQueMoveu));

        service.mover(10L, 2L, 0, adminQueMoveu);

        verify(envioWhatsApp, never()).enviar(any(), any());
    }

    @Test
    void moverDentroDaMesmaColunaNaoAvisaOAdmin() {
        Usuario admin = adminComId(20L, "Admin Geral");
        admin.alterarWhatsapp("5511977776666");
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        lenient().when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)).thenReturn(List.of(admin));

        service.mover(10L, 1L, 0, criadoPor);

        verify(envioWhatsApp, never()).enviar(any(), any());
    }

    @Test
    void moverParaColunaNoLimiteWipLancaLimiteWipExcedido() {
        Coluna destino = colunaComId(2L, 2);
        Card card = cardComId(10L, coluna, 1024.0);
        Card outro1 = cardComId(20L, destino, 100.0);
        Card outro2 = cardComId(21L, destino, 200.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of(outro1, outro2));

        assertThatThrownBy(() -> service.mover(10L, 2L, 0, criadoPor)).isInstanceOf(LimiteWipExcedidoException.class);

        verify(cardRepository, never()).save(any());
        verify(projetoWebSocketHandler, never()).broadcastCardMovido(any(), any());
        verify(cardEventoRepository, never()).save(any());
    }

    @Test
    void moverParaColunaAbaixoDoLimiteWipPermite() {
        Coluna destino = colunaComId(2L, 3);
        Card card = cardComId(10L, coluna, 1024.0);
        Card outro = cardComId(20L, destino, 100.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of(outro));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 1, criadoPor);

        assertThat(resposta.colunaId()).isEqualTo(2L);
    }

    @Test
    void moverParaColunaSemLimiteWipNuncaBloqueia() {
        Coluna destino = colunaComId(2L, null);
        Card card = cardComId(10L, coluna, 1024.0);
        Card outro1 = cardComId(20L, destino, 100.0);
        Card outro2 = cardComId(21L, destino, 200.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of(outro1, outro2));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 2, criadoPor);

        assertThat(resposta.colunaId()).isEqualTo(2L);
    }

    @Test
    void moverDentroDaMesmaColunaNoLimiteWipNaoBloqueia() {
        // a coluna já tem exatamente o limite (contando o próprio card) - reordenar dentro dela
        // não aumenta a ocupação, só o mover pra OUTRA coluna cheia deveria ser bloqueado.
        Coluna colunaCheia = colunaComId(1L, 2);
        Card card = cardComId(10L, colunaCheia, 300.0);
        Card outro = cardComId(11L, colunaCheia, 100.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(colunaCheia));
        when(cardRepository.findByColunaOrderByPosicaoAsc(colunaCheia)).thenReturn(List.of(outro, card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 1L, 0, criadoPor);

        assertThat(resposta.colunaId()).isEqualTo(1L);
    }

    @Test
    void moverParaColunaVaziaUsaPosicaoBase() {
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 0, criadoPor);

        assertThat(resposta.colunaId()).isEqualTo(2L);
        assertThat(resposta.posicao()).isEqualTo(CalculadoraPosicao.POSICAO_BASE);
    }

    @Test
    void moverParaOMeioDaColunaFicaEstritamenteEntreOsVizinhos() {
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        Card vizinho1 = cardComId(20L, destino, 100.0);
        Card vizinho2 = cardComId(21L, destino, 200.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of(vizinho1, vizinho2));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 1, criadoPor);

        assertThat(resposta.posicao()).isGreaterThan(100.0).isLessThan(200.0);
    }

    @Test
    void moverDentroDaMesmaColunaExcluiOProprioCardDosVizinhos() {
        Card card = cardComId(10L, coluna, 300.0);
        Card outro = cardComId(11L, coluna, 100.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        // a própria coluna já inclui o card 10L na lista - o serviço precisa filtrá-lo
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(outro, card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 1L, 0, criadoPor);

        assertThat(resposta.posicao()).isLessThan(100.0);
    }

    @Test
    void moverNuncaSalvaOutrosCardsDaColuna() {
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        Card vizinho = cardComId(20L, destino, 100.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of(vizinho));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.mover(10L, 2L, 1, criadoPor);

        verify(cardRepository, times(1)).save(any());
        verify(cardRepository, never()).save(eq(vizinho));
    }

    @Test
    void moverCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.mover(999L, 2L, 0, criadoPor)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void moverBroadcastaOCardMovidoPraSessoesDoProjetoDeDestino() {
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.mover(10L, 2L, 0, criadoPor);

        var captor = ArgumentCaptor.forClass(CardResponse.class);
        verify(projetoWebSocketHandler).broadcastCardMovido(eq(destino.getProjeto().getId()), captor.capture());
        assertThat(captor.getValue().id()).isEqualTo(10L);
        assertThat(captor.getValue().colunaId()).isEqualTo(2L);
    }

    @Test
    void criarNuncaBroadcasta() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna)).thenReturn(Optional.empty());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor);

        verify(projetoWebSocketHandler, never()).broadcastCardMovido(any(), any());
    }

    @Test
    void moverParaColunaInexistenteLancaRecursoNaoEncontrado() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.mover(10L, 99L, 0, criadoPor)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void moverParaOutraColunaGeraEventoDeMudancaDeColuna() {
        Coluna destino = colunaComId(2L);
        ReflectionTestUtils.setField(destino, "nome", "Em progresso");
        Card card = cardComId(10L, coluna, 1024.0);
        Usuario quemMoveu = usuarioComId(2L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.mover(10L, 2L, 0, quemMoveu);

        var captor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(captor.capture());
        assertThat(captor.getValue().getTipo()).isEqualTo(TipoEventoCard.MUDANCA_COLUNA);
        assertThat(captor.getValue().getDe()).isEqualTo("A fazer");
        assertThat(captor.getValue().getPara()).isEqualTo("Em progresso");
        assertThat(captor.getValue().getAutor()).isSameAs(quemMoveu);
    }

    @Test
    void reordenarDentroDaMesmaColunaNaoGeraEventoDeMudancaDeColuna() {
        Card card = cardComId(10L, coluna, 300.0);
        Card outro = cardComId(11L, coluna, 100.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(outro, card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.mover(10L, 1L, 0, criadoPor);

        verify(cardEventoRepository, never()).save(any());
        verify(presencaWebSocketHandler, never()).avisarTarefaConcluida(any(), any());
    }

    // ---------- pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado" ----------

    @Test
    void moverParaAUltimaColunaDoProjetoNotificaResponsavelECriadorExcetoQuemMoveu() {
        Coluna destino = colunaComId(2L);
        Coluna primeiraColuna = outraColunaMesmoProjeto(destino, 1L, "A fazer");
        Usuario responsavel = usuarioComId(3L);
        Usuario quemMoveu = usuarioComId(4L);
        Card card = new Card(primeiraColuna, "Corrigir bug", null, 1024.0, responsavel, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", 10L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(primeiraColuna, destino));

        service.mover(10L, 2L, 0, quemMoveu);

        verify(presencaWebSocketHandler).avisarTarefaConcluida(eq(responsavel.getId()), any());
        verify(presencaWebSocketHandler).avisarTarefaConcluida(eq(criadoPor.getId()), any());
        verify(presencaWebSocketHandler, never()).avisarTarefaConcluida(eq(quemMoveu.getId()), any());
        // pedido do usuário: "ver as últimas que chegaram no sistema" - mesmos destinatários da
        // notificação em tempo real, agora também persistidos.
        verify(notificacaoService).registrar(eq(responsavel), eq(TipoNotificacao.TAREFA_CONCLUIDA), any(), isNull());
        verify(notificacaoService).registrar(eq(criadoPor), eq(TipoNotificacao.TAREFA_CONCLUIDA), any(), isNull());
        verify(notificacaoService, never()).registrar(eq(quemMoveu), any(), any(), any());
        // nem responsável nem criadoPor têm WhatsApp cadastrado neste teste - sem número, sem envio
        verify(envioWhatsApp, never()).enviar(any(), any());
    }

    /** Pedido do usuário: avisar por WhatsApp quando uma tarefa é concluída, além do aviso já
     * existente na tela - só quem cadastrou o próprio WhatsApp (ADMIN-only, {@code
     * Usuario#alterarWhatsapp}). */
    @Test
    void moverParaAUltimaColunaAvisaPorWhatsappQuemTemNumeroCadastrado() {
        Coluna destino = colunaComId(2L);
        Coluna primeiraColuna = outraColunaMesmoProjeto(destino, 1L, "A fazer");
        Usuario responsavel = usuarioComId(3L);
        responsavel.alterarWhatsapp("5511988887777");
        Usuario quemMoveu = usuarioComId(4L);
        // criadoPor (campo da classe) nunca teve alterarWhatsapp chamado - continua sem número
        Card card = new Card(primeiraColuna, "Corrigir bug", null, 1024.0, responsavel, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", 10L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(primeiraColuna, destino));

        service.mover(10L, 2L, 0, quemMoveu);

        verify(envioWhatsApp).enviar(eq("5511988887777"), any());
        verify(envioWhatsApp, never()).enviar(argThat(numero -> !numero.equals("5511988887777")), any());
    }

    @Test
    void moverParaUmaColunaDoMeioNaoNotificaNinguem() {
        Coluna destino = colunaComId(2L);
        Coluna ultimaColuna = outraColunaMesmoProjeto(destino, 3L, "Concluído");
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(destino, ultimaColuna));

        service.mover(10L, 2L, 0, criadoPor);

        verify(presencaWebSocketHandler, never()).avisarTarefaConcluida(any(), any());
    }

    @Test
    void moverParaAUltimaColunaSemResponsavelNotificaSoOCriador() {
        Coluna destino = colunaComId(2L);
        Coluna primeiraColuna = outraColunaMesmoProjeto(destino, 1L, "A fazer");
        Usuario quemMoveu = usuarioComId(4L);
        Card card = cardComId(10L, primeiraColuna, 1024.0); // sem responsável, criadoPor = campo da classe (id 1)
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(primeiraColuna, destino));

        service.mover(10L, 2L, 0, quemMoveu);

        verify(presencaWebSocketHandler, times(1)).avisarTarefaConcluida(eq(criadoPor.getId()), any());
    }

    @Test
    void moverParaAUltimaColunaComResponsavelIgualAoCriadorNotificaUmaVezSo() {
        Coluna destino = colunaComId(2L);
        Coluna primeiraColuna = outraColunaMesmoProjeto(destino, 1L, "A fazer");
        Usuario quemMoveu = usuarioComId(4L);
        Card card = new Card(primeiraColuna, "Corrigir bug", null, 1024.0, criadoPor, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", 10L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(primeiraColuna, destino));

        service.mover(10L, 2L, 0, quemMoveu);

        verify(presencaWebSocketHandler, times(1)).avisarTarefaConcluida(eq(criadoPor.getId()), any());
    }

    @Test
    void moverOProprioCardSozinhoPraAUltimaColunaNaoNotificaNinguem() {
        // responsável == criador == autor - ninguém sobra pra avisar depois de excluir quem moveu.
        Coluna destino = colunaComId(2L);
        Coluna primeiraColuna = outraColunaMesmoProjeto(destino, 1L, "A fazer");
        Card card = new Card(primeiraColuna, "Corrigir bug", null, 1024.0, criadoPor, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", 10L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(destino.getProjeto())).thenReturn(List.of(primeiraColuna, destino));

        service.mover(10L, 2L, 0, criadoPor);

        verify(presencaWebSocketHandler, never()).avisarTarefaConcluida(any(), any());
    }

    @Test
    void moverParaOutraColunaSemInformacaoDasColunasDoProjetoNaoQuebraNemNotifica() {
        // defensivo - `findByProjetoOrderByOrdemAsc` sem stub devolve lista vazia (padrão do
        // Mockito pra retorno `List`), não deveria acontecer de verdade (a própria coluna de
        // destino é uma coluna real do projeto), mas não pode derrubar o mover em si.
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 0, criadoPor);

        assertThat(resposta.colunaId()).isEqualTo(2L);
        verify(presencaWebSocketHandler, never()).avisarTarefaConcluida(any(), any());
    }

    // ---------- auditoria de segurança (VULN-02, HIGH) ----------

    @Test
    void criarEmColunaDeProjetoSemAcessoLancaAcessoNegado() {
        when(colunaRepository.findById(1L)).thenReturn(Optional.of(coluna));
        when(projetoService.usuarioPodeVer(coluna.getProjeto().getId(), criadoPor)).thenReturn(false);

        assertThatThrownBy(() -> service.criar(1L, "Corrigir bug", null, null, null, null, criadoPor))
                .isInstanceOf(AcessoNegadoException.class);

        verify(cardRepository, never()).save(any());
    }

    /**
     * O PoC ao vivo desta auditoria: um usuário sem NENHUM vínculo com o projeto do card movia
     * (e via corpo da resposta, lia título/descrição de) um card de um projeto que nem aparecia
     * pra ele em {@code GET /projetos}. `AcessoNegadoException` aqui esconde a existência do card
     * por completo - nem chega a avaliar a coluna de destino.
     */
    @Test
    void moverCardDeProjetoSemAcessoLancaAcessoNegadoENuncaSalva() {
        Card card = cardComId(10L, coluna, 1024.0);
        Usuario semAcesso = usuarioComId(99L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(projetoService.usuarioPodeVer(coluna.getProjeto().getId(), semAcesso)).thenReturn(false);

        assertThatThrownBy(() -> service.mover(10L, 2L, 0, semAcesso)).isInstanceOf(AcessoNegadoException.class);

        verify(cardRepository, never()).save(any());
        verify(colunaRepository, never()).findById(2L);
        verify(projetoWebSocketHandler, never()).broadcastCardMovido(any(), any());
    }

    /**
     * Mesmo um autor com acesso normal a AMBOS os projetos não pode transferir um card de um pro
     * outro - nunca foi uma funcionalidade oferecida (o board do frontend só arrasta dentro do
     * projeto aberto), então é tratado como erro sempre.
     */
    @Test
    void moverCardParaColunaDeOutroProjetoLancaAcessoNegadoMesmoComAcessoAosDois() {
        Coluna colunaDoOutroProjeto = colunaComId(2L, null, 200L); // projeto 200L, diferente do 100L da `coluna`
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(colunaDoOutroProjeto));
        // usuarioPodeVer -> true pros dois projetos (default do @BeforeEach) - mesmo assim deve
        // recusar, porque a regra não é de visibilidade, é "isto nunca foi permitido".

        assertThatThrownBy(() -> service.mover(10L, 2L, 0, criadoPor)).isInstanceOf(AcessoNegadoException.class);

        verify(cardRepository, never()).save(any());
        verify(projetoWebSocketHandler, never()).broadcastCardMovido(any(), any());
    }

    // ---------- pedido do usuário: "não conseguimos editar e apagar algumas atividades" ----------

    @Test
    void atualizaTituloDescricaoPrazoEEstimativa() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.atualizar(10L, "Novo título", "Nova descrição", null, LocalDate.of(2026, 12, 1), 90, criadoPor);

        assertThat(resposta.titulo()).isEqualTo("Novo título");
        assertThat(resposta.descricao()).isEqualTo("Nova descrição");
        assertThat(resposta.prazo()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(resposta.estimativaMinutos()).isEqualTo(90);
    }

    @Test
    void atualizarSemTituloLancaExcecaoSemSalvar() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));

        assertThatThrownBy(() -> service.atualizar(10L, "  ", null, null, null, null, criadoPor))
                .isInstanceOf(TituloCardObrigatorioException.class);

        verify(cardRepository, never()).save(any());
    }

    @Test
    void atualizarCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.atualizar(99L, "Título", null, null, null, null, criadoPor))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void atualizarSemAcessoAoProjetoLancaAcessoNegadoENuncaSalva() {
        Card card = cardComId(10L, coluna, 1024.0);
        Usuario semAcesso = usuarioComId(99L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(projetoService.usuarioPodeVer(coluna.getProjeto().getId(), semAcesso)).thenReturn(false);

        assertThatThrownBy(() -> service.atualizar(10L, "Título", null, null, null, null, semAcesso))
                .isInstanceOf(AcessoNegadoException.class);

        verify(cardRepository, never()).save(any());
    }

    @Test
    void atualizarDefinindoResponsavelPelaPrimeiraVezGeraEventoDeMudancaDeResponsavel() {
        Card card = cardComId(10L, coluna, 1024.0);
        Usuario novoResponsavel = usuarioComId(2L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(novoResponsavel));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.atualizar(10L, "Título", null, 2L, null, null, criadoPor);

        var captor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(captor.capture());
        assertThat(captor.getValue().getTipo()).isEqualTo(TipoEventoCard.MUDANCA_RESPONSAVEL);
        assertThat(captor.getValue().getDe()).isNull();
        assertThat(captor.getValue().getPara()).isEqualTo("Ana Souza");
    }

    @Test
    void atualizarSemMudarOResponsavelNaoGeraEvento() {
        Usuario responsavel = usuarioComId(2L);
        Card card = new Card(coluna, "Card 10", null, 1024.0, responsavel, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", 10L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(responsavel));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.atualizar(10L, "Título mudou, responsável não", null, 2L, null, null, criadoPor);

        verify(cardEventoRepository, never()).save(any());
    }

    @Test
    void atualizarBroadcastaCardAtualizadoNoWebsocketDoProjeto() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.atualizar(10L, "Título", null, null, null, null, criadoPor);

        verify(projetoWebSocketHandler).broadcastCardAtualizado(eq(coluna.getProjeto().getId()), any());
    }

    @Test
    void excluiOCardDeVerdade() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));

        service.excluir(10L, criadoPor);

        verify(cardRepository).delete(card);
        verify(projetoWebSocketHandler).broadcastCardExcluido(eq(coluna.getProjeto().getId()), any());
    }

    @Test
    void excluirCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.excluir(99L, criadoPor)).isInstanceOf(RecursoNaoEncontradoException.class);

        verify(cardRepository, never()).delete(any());
    }

    @Test
    void excluirSemAcessoAoProjetoLancaAcessoNegadoENuncaApaga() {
        Card card = cardComId(10L, coluna, 1024.0);
        Usuario semAcesso = usuarioComId(99L);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(projetoService.usuarioPodeVer(coluna.getProjeto().getId(), semAcesso)).thenReturn(false);

        assertThatThrownBy(() -> service.excluir(10L, semAcesso)).isInstanceOf(AcessoNegadoException.class);

        verify(cardRepository, never()).delete(any());
        verify(projetoWebSocketHandler, never()).broadcastCardExcluido(any(), any());
    }
}
