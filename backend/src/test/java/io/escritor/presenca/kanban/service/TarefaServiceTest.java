package io.escritor.presenca.kanban.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.EstadoTarefa;
import io.escritor.presenca.kanban.domain.EstadoTarefaIndisponivelException;
import io.escritor.presenca.kanban.domain.ProjetoSemColunasException;
import io.escritor.presenca.kanban.domain.TarefaJaFinalizadaException;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.TarefaResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class TarefaServiceTest {

    @Mock
    private CardRepository cardRepository;

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private ProjetoPessoalService projetoPessoalService;

    @Mock
    private CardService cardService;

    @Mock
    private ProjetoService projetoService;

    private final Usuario usuario = usuarioComId(1L);
    private final Projeto projeto = projetoComId(10L, "Site");
    private final Coluna aFazer = colunaComId(projeto, 100L, "A fazer", 0);
    private final Coluna andamento = colunaComId(projeto, 101L, "Em andamento", 1);
    private final Coluna feito = colunaComId(projeto, 102L, "Feito", 2);

    private TarefaService service;

    private static Usuario usuarioComId(Long id) {
        Usuario u = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static Projeto projetoComId(Long id, String nome) {
        Projeto p = new Projeto(nome, "Cliente", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(p, "id", id);
        return p;
    }

    private static Coluna colunaComId(Projeto projeto, Long id, String nome, int ordem) {
        Coluna c = new Coluna(projeto, nome, ordem, null);
        ReflectionTestUtils.setField(c, "id", id);
        return c;
    }

    private Card card(Long id, Coluna coluna, LocalDate prazo, Instant criadoEm, Instant concluidoEm) {
        Card c = new Card(coluna, "Card " + id, null, 1.0, usuario, prazo, null, usuario);
        ReflectionTestUtils.setField(c, "id", id);
        ReflectionTestUtils.setField(c, "criadoEm", criadoEm);
        ReflectionTestUtils.setField(c, "concluidoEm", concluidoEm);
        return c;
    }

    @BeforeEach
    void setUp() {
        service = new TarefaService(cardRepository, colunaRepository, projetoRepository, projetoPessoalService, cardService, projetoService);
        lenient().when(projetoService.usuarioPodeVer(any(), any())).thenReturn(true);
    }

    private void colunasDoProjeto() {
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(aFazer, andamento, feito));
    }

    @Test
    void listaSoCardsDoResponsavelNaoArquivados() {
        Card a = card(1L, aFazer, null, Instant.parse("2026-01-01T00:00:00Z"), null);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(List.of(a));
        colunasDoProjeto();

        List<TarefaResponse> lista = service.listarMinhas(usuario);

        assertThat(lista).hasSize(1);
        TarefaResponse t = lista.get(0);
        assertThat(t.cardId()).isEqualTo(1L);
        assertThat(t.projetoId()).isEqualTo(10L);
        assertThat(t.projetoNome()).isEqualTo("Site");
        assertThat(t.pessoal()).isFalse();
        assertThat(t.estado()).isEqualTo(EstadoTarefa.A_FAZER);
    }

    @Test
    void tarefaDeProjetoPessoalNaoExpoeNomeDoProjeto() {
        Projeto pessoal = Projeto.pessoalDe(usuario, LocalDate.now());
        ReflectionTestUtils.setField(pessoal, "id", 11L);
        Coluna c0 = colunaComId(pessoal, 200L, "A fazer", 0);
        Card a = card(1L, c0, null, Instant.now(), null);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(List.of(a));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(pessoal)).thenReturn(List.of(c0));

        TarefaResponse t = service.listarMinhas(usuario).get(0);

        assertThat(t.pessoal()).isTrue();
        assertThat(t.projetoNome()).isNull();
    }

    @Test
    void ordenaPorPrazoNuloPorUltimoEDepoisPorCriacao() {
        Instant base = Instant.parse("2026-01-01T00:00:00Z");
        Card semPrazoAntigo = card(1L, aFazer, null, base, null);
        Card semPrazoNovo = card(2L, aFazer, null, base.plusSeconds(60), null);
        Card prazoTarde = card(3L, aFazer, LocalDate.of(2026, 3, 1), base.plusSeconds(10), null);
        Card prazoCedo = card(4L, aFazer, LocalDate.of(2026, 2, 1), base.plusSeconds(20), null);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario))
                .thenReturn(List.of(semPrazoNovo, prazoTarde, semPrazoAntigo, prazoCedo));
        colunasDoProjeto();

        List<Long> ids = service.listarMinhas(usuario).stream().map(TarefaResponse::cardId).toList();

        assertThat(ids).containsExactly(4L, 3L, 1L, 2L);
    }

    @Test
    void feitoVemOrdenadoPorConclusaoELimitadoA20() {
        Instant base = Instant.parse("2026-01-01T00:00:00Z");
        List<Card> cards = new ArrayList<>();
        for (long i = 1; i <= 25; i++) {
            cards.add(card(i, feito, null, base, base.plusSeconds(i)));
        }
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(cards);
        colunasDoProjeto();

        List<TarefaResponse> lista = service.listarMinhas(usuario);

        assertThat(lista).hasSize(20);
        assertThat(lista.get(0).cardId()).isEqualTo(25L);
        assertThat(lista.get(19).cardId()).isEqualTo(6L);
        assertThat(lista).allMatch(t -> t.estado() == EstadoTarefa.FEITO);
    }

    @Test
    void feitoComConclusaoNulaVaiPorUltimoEDesempataPorIdDecrescente() {
        Instant base = Instant.parse("2026-01-01T00:00:00Z");
        Card semData = card(9L, feito, null, base, null);
        Card a = card(1L, feito, null, base, base);
        Card b = card(2L, feito, null, base, base);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(List.of(semData, a, b));
        colunasDoProjeto();

        List<Long> ids = service.listarMinhas(usuario).stream().map(TarefaResponse::cardId).toList();

        assertThat(ids).containsExactly(2L, 1L, 9L);
    }

    @Test
    void criarSemProjetoUsaProjetoPessoalEPrimeiraColuna() {
        Projeto pessoal = Projeto.pessoalDe(usuario, LocalDate.now());
        ReflectionTestUtils.setField(pessoal, "id", 11L);
        Coluna c0 = colunaComId(pessoal, 200L, "A fazer", 0);
        Coluna c1 = colunaComId(pessoal, 201L, "Em andamento", 1);
        Coluna c2 = colunaComId(pessoal, 202L, "Feito", 2);
        when(projetoPessoalService.obterOuCriar(usuario)).thenReturn(pessoal);
        when(colunaRepository.findByProjetoOrderByOrdemAsc(pessoal)).thenReturn(List.of(c0, c1, c2));
        Card criado = card(5L, c0, null, Instant.now(), null);
        when(cardService.criar(eq(200L), eq("Pagar boleto"), isNull(), eq(1L), isNull(), isNull(), eq(usuario)))
                .thenReturn(CardResponse.de(criado));
        when(cardRepository.findById(5L)).thenReturn(Optional.of(criado));

        TarefaResponse t = service.criar(usuario, "  Pagar boleto  ", null, null, null);

        assertThat(t.cardId()).isEqualTo(5L);
        assertThat(t.pessoal()).isTrue();
        assertThat(t.estado()).isEqualTo(EstadoTarefa.A_FAZER);
        verify(projetoRepository, never()).findById(any());
    }

    @Test
    void criarComProjetoUsaPrimeiraColuna() {
        when(projetoRepository.findById(10L)).thenReturn(Optional.of(projeto));
        colunasDoProjeto();
        LocalDate prazo = LocalDate.of(2026, 12, 1);
        Card criado = card(6L, aFazer, prazo, Instant.now(), null);
        when(cardService.criar(100L, "Tarefa", null, 1L, prazo, 30, usuario)).thenReturn(CardResponse.de(criado));
        when(cardRepository.findById(6L)).thenReturn(Optional.of(criado));

        TarefaResponse t = service.criar(usuario, "Tarefa", 10L, prazo, 30);

        assertThat(t.projetoId()).isEqualTo(10L);
        assertThat(t.projetoNome()).isEqualTo("Site");
        verify(projetoPessoalService, never()).obterOuCriar(any());
    }

    @Test
    void criarEmProjetoSemColunasLancaProjetoSemColunas() {
        when(projetoRepository.findById(10L)).thenReturn(Optional.of(projeto));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of());

        assertThatThrownBy(() -> service.criar(usuario, "Tarefa", 10L, null, null))
                .isInstanceOf(ProjetoSemColunasException.class);
        verify(cardService, never()).criar(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void mudarEstadoMoveParaColunaCorretaNoFimDela() {
        Card c = card(7L, aFazer, null, Instant.now(), null);
        Card outro1 = card(8L, feito, null, Instant.now(), null);
        Card outro2 = card(9L, feito, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        colunasDoProjeto();
        when(cardRepository.findByColunaOrderByPosicaoAsc(feito)).thenReturn(List.of(outro1, outro2));

        service.mudarEstado(7L, EstadoTarefa.FEITO, usuario);

        verify(cardService).mover(7L, 102L, 2, usuario);
    }

    @Test
    void mudarEstadoNaoContaOProprioCardNoIndiceFinal() {
        Card c = card(7L, andamento, null, Instant.now(), null);
        Card outro = card(8L, andamento, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        colunasDoProjeto();
        when(cardRepository.findByColunaOrderByPosicaoAsc(andamento)).thenReturn(List.of(c, outro));

        service.mudarEstado(7L, EstadoTarefa.EM_ANDAMENTO, usuario);

        verify(cardService).mover(7L, 101L, 1, usuario);
    }

    @Test
    void mudarEstadoDeTarefaFinalizadaLanca409() {
        Card c = card(7L, feito, null, Instant.now(), Instant.now());
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> service.mudarEstado(7L, EstadoTarefa.A_FAZER, usuario))
                .isInstanceOf(TarefaJaFinalizadaException.class);
        verify(cardService, never()).mover(any(), any(), anyInt(), any());
    }

    @Test
    void mudarEstadoParaEmAndamentoEmProjetoSemEtapaLancaIndisponivel() {
        Card c = card(7L, aFazer, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(aFazer, feito));

        assertThatThrownBy(() -> service.mudarEstado(7L, EstadoTarefa.EM_ANDAMENTO, usuario))
                .isInstanceOf(EstadoTarefaIndisponivelException.class)
                .hasMessageContaining("Em andamento");
        verify(cardService, never()).mover(any(), any(), anyInt(), any());
    }

    @Test
    void criarEmProjetoQueOUsuarioNaoVeLanca404SemRevelarColunas() {
        when(projetoService.usuarioPodeVer(10L, usuario)).thenReturn(false);

        assertThatThrownBy(() -> service.criar(usuario, "Tarefa", 10L, null, null))
                .isInstanceOf(RecursoNaoEncontradoException.class);
        verifyNoInteractions(projetoRepository, colunaRepository, cardService, projetoPessoalService);
    }

    @Test
    void criarEmProjetoInexistenteLanca404() {
        when(projetoService.usuarioPodeVer(99L, usuario)).thenReturn(false);

        assertThatThrownBy(() -> service.criar(usuario, "Tarefa", 99L, null, null))
                .isInstanceOf(RecursoNaoEncontradoException.class);
        verifyNoInteractions(colunaRepository, cardService);
    }

    @Test
    void mudarEstadoSemAcessoAoProjetoLanca404MesmoComTarefaFinalizada() {
        Card c = card(7L, feito, null, Instant.now(), Instant.now());
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        when(projetoService.usuarioPodeVer(10L, usuario)).thenReturn(false);

        assertThatThrownBy(() -> service.mudarEstado(7L, EstadoTarefa.A_FAZER, usuario))
                .isInstanceOf(RecursoNaoEncontradoException.class);
        verifyNoInteractions(colunaRepository, cardService);
    }


    @Test
    void mudarEstadoEmProjetoDeUmaColunaFazendoParaEstadoAusenteLancaIndisponivel() {
        Coluna fazendo = colunaComId(projeto, 103L, "Fazendo", 0);
        Card c = card(7L, fazendo, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(fazendo));

        assertThatThrownBy(() -> service.mudarEstado(7L, EstadoTarefa.FEITO, usuario))
                .isInstanceOf(EstadoTarefaIndisponivelException.class);
        verify(cardService, never()).mover(any(), any(), anyInt(), any());
    }

    @Test
    void cardEmColunaBacklogListaComoAFazerEExpoeEstadosDisponiveis() {
        Coluna fazendo = colunaComId(projeto, 103L, "Fazendo", 1);
        Coluna feitoCol = colunaComId(projeto, 104L, "Feito", 2);
        Coluna backlog = colunaComId(projeto, 105L, "Backlog", 3);
        Card c = card(7L, backlog, null, Instant.now(), null);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(List.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(fazendo, feitoCol, backlog));

        TarefaResponse t = service.listarMinhas(usuario).get(0);

        assertThat(t.estado()).isEqualTo(EstadoTarefa.A_FAZER);
        assertThat(t.estadosDisponiveis())
                .containsExactly(EstadoTarefa.A_FAZER, EstadoTarefa.EM_ANDAMENTO, EstadoTarefa.FEITO);
    }

    @Test
    void cardEmColunaFeitoNaoUltimaListaComoFeito() {
        Coluna feitoCol = colunaComId(projeto, 104L, "Feito", 1);
        Coluna backlog = colunaComId(projeto, 105L, "Backlog", 2);
        Card c = card(7L, feitoCol, null, Instant.now(), null);
        when(cardRepository.findByResponsavelAndArquivadoFalse(usuario)).thenReturn(List.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(aFazer, feitoCol, backlog));

        assertThat(service.listarMinhas(usuario).get(0).estado()).isEqualTo(EstadoTarefa.FEITO);
    }

    @Test
    void mudarEstadoParaEtapaExistenteMovePelaColunaDeNome() {
        Coluna fazendo = colunaComId(projeto, 103L, "Fazendo", 0);
        Coluna feitoCol = colunaComId(projeto, 104L, "Feito", 1);
        Coluna backlog = colunaComId(projeto, 105L, "Backlog", 2);
        Card c = card(7L, fazendo, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(fazendo, feitoCol, backlog));
        when(cardRepository.findByColunaOrderByPosicaoAsc(backlog)).thenReturn(List.of());

        TarefaResponse resposta = service.mudarEstado(7L, EstadoTarefa.A_FAZER, usuario);

        verify(cardService).mover(7L, 105L, 0, usuario);
        assertThat(resposta.estado()).isEqualTo(EstadoTarefa.A_FAZER);
    }

    @Test
    void mudarEstadoEmProjetoSemColunasLancaProjetoSemColunas() {
        Card c = card(7L, aFazer, null, Instant.now(), null);
        when(cardRepository.findById(7L)).thenReturn(Optional.of(c));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of());

        assertThatThrownBy(() -> service.mudarEstado(7L, EstadoTarefa.A_FAZER, usuario))
                .isInstanceOf(ProjetoSemColunasException.class);
    }

    private void criarEmQuadroEVerificarColuna(List<Coluna> colunas, Long colunaEsperada) {
        when(projetoRepository.findById(10L)).thenReturn(Optional.of(projeto));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(colunas);
        Card criado = card(6L, colunas.get(0), null, Instant.now(), null);
        when(cardService.criar(eq(colunaEsperada), eq("Tarefa"), isNull(), eq(1L), isNull(), isNull(), eq(usuario)))
                .thenReturn(CardResponse.de(criado));
        when(cardRepository.findById(6L)).thenReturn(Optional.of(criado));

        service.criar(usuario, "Tarefa", 10L, null, null);

        verify(cardService).criar(eq(colunaEsperada), eq("Tarefa"), isNull(), eq(1L), isNull(), isNull(), eq(usuario));
    }

    @Test
    void criarEmQuadroComBacklogUsaAColunaQueEhAFazerENaoAPrimeira() {
        Coluna fazendo = colunaComId(projeto, 103L, "Fazendo", 1);
        Coluna feitoCol = colunaComId(projeto, 104L, "Feito", 2);
        Coluna backlog = colunaComId(projeto, 105L, "Backlog", 3);
        criarEmQuadroEVerificarColuna(List.of(fazendo, feitoCol, backlog), 105L);
    }

    @Test
    void criarEmQuadroCambIAUsaAFazer() {
        Coluna a = colunaComId(projeto, 201L, "A fazer", 0);
        Coluna f = colunaComId(projeto, 202L, "Feito", 1);
        Coluna b = colunaComId(projeto, 203L, "Backlog", 2);
        criarEmQuadroEVerificarColuna(List.of(a, f, b), 201L);
    }

    @Test
    void criarEmQuadroDeUmaColunaFazendoUsaEssaColuna() {
        Coluna fazendo = colunaComId(projeto, 301L, "Fazendo", 0);
        criarEmQuadroEVerificarColuna(List.of(fazendo), 301L);
    }

    @Test
    void criarNoProjetoPessoalUsaAFazer() {
        Projeto pessoal = Projeto.pessoalDe(usuario, LocalDate.now());
        ReflectionTestUtils.setField(pessoal, "id", 11L);
        Coluna c0 = colunaComId(pessoal, 200L, "A fazer", 0);
        Coluna c1 = colunaComId(pessoal, 201L, "Em andamento", 1);
        Coluna c2 = colunaComId(pessoal, 202L, "Feito", 2);
        when(projetoPessoalService.obterOuCriar(usuario)).thenReturn(pessoal);
        when(colunaRepository.findByProjetoOrderByOrdemAsc(pessoal)).thenReturn(List.of(c0, c1, c2));
        Card criado = card(5L, c0, null, Instant.now(), null);
        when(cardService.criar(eq(200L), eq("X"), isNull(), eq(1L), isNull(), isNull(), eq(usuario)))
                .thenReturn(CardResponse.de(criado));
        when(cardRepository.findById(5L)).thenReturn(Optional.of(criado));

        service.criar(usuario, "X", null, null, null);

        verify(cardService).criar(eq(200L), eq("X"), isNull(), eq(1L), isNull(), isNull(), eq(usuario));
    }
}
