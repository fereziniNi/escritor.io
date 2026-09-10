package io.escritor.presenca.kanban.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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

    private final Coluna coluna = colunaComId(1L);
    private final Usuario criadoPor = usuarioComId(1L);

    private CardService service;

    private static Coluna colunaComId(Long id) {
        return colunaComId(id, null);
    }

    private static Coluna colunaComId(Long id, Integer limiteWip) {
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
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

    private Card cardComId(Long id, Coluna colunaDoCard, double posicao) {
        Card card = new Card(colunaDoCard, "Card " + id, null, posicao, null, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new CardService(
                cardRepository, colunaRepository, usuarioRepository, projetoWebSocketHandler, cardEventoRepository,
                presencaWebSocketHandler, notificacaoService);
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
}
