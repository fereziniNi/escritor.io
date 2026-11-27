package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.CronometroJaEmAndamentoException;
import io.escritor.presenca.kanban.domain.CronometroNaoIniciadoException;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.kanban.web.CronometroAtivoResponse;
import io.escritor.presenca.kanban.web.CronometroResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessaoTrabalhoServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-13T12:00:00Z"), ZoneOffset.UTC);

    @Mock
    private CardRepository cardRepository;

    @Mock
    private SessaoTrabalhoRepository sessaoTrabalhoRepository;

    @Mock
    private CardEventoRepository cardEventoRepository;

    @Mock
    private ProjetoService projetoService;

    private final Usuario autor = usuarioComId(1L);
    private Card card;

    private SessaoTrabalhoService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @BeforeEach
    void setUp() {
        service = new SessaoTrabalhoService(cardRepository, sessaoTrabalhoRepository, cardEventoRepository, new AcessoAoCard(projetoService), RELOGIO_FIXO);
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", 5L);
        Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
        card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor);
        ReflectionTestUtils.setField(card, "id", 10L);
        lenient().when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        lenient().when(projetoService.usuarioPodeVer(5L, autor)).thenReturn(true);
    }

    @Test
    void iniciarCriaUmaSessaoAbertaEGeraOEventoDeHistorico() {
        var captor = ArgumentCaptor.forClass(SessaoTrabalho.class);
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor)).thenReturn(Optional.empty());
        // 1ª chamada (dentro de iniciar()): confirma que não há sessão aberta ainda.
        // 2ª chamada (dentro de status()): já reflete a sessão recém-criada, como o banco faria.
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card))
                .thenReturn(Optional.empty())
                .thenAnswer(invocation -> Optional.of(captor.getValue()));
        when(sessaoTrabalhoRepository.save(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());

        CronometroResponse resposta = service.iniciar(10L, autor);

        assertThat(resposta.iniciadoEm()).isEqualTo(RELOGIO_FIXO.instant());
        assertThat(resposta.totalMinutosFechados()).isZero();
        assertThat(captor.getValue().getCard()).isSameAs(card);
        assertThat(captor.getValue().getUsuario()).isSameAs(autor);
        var eventoCaptor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(eventoCaptor.capture());
        assertThat(eventoCaptor.getValue().getTipo()).isEqualTo(TipoEventoCard.INICIOU_TRABALHO);
    }

    @Test
    void iniciarComSessaoJaAbertaLancaExcecao() {
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card))
                .thenReturn(Optional.of(new SessaoTrabalho(card, autor, Instant.parse("2026-01-13T10:00:00Z"))));

        assertThatThrownBy(() -> service.iniciar(10L, autor)).isInstanceOf(CronometroJaEmAndamentoException.class);
        verify(sessaoTrabalhoRepository, never()).save(any());
    }

    @Test
    void iniciarComTarefaJaFinalizadaLancaExcecao() {
        card.finalizar("Feito", Instant.parse("2026-01-12T18:00:00Z"));

        assertThatThrownBy(() -> service.iniciar(10L, autor)).isInstanceOf(CronometroJaEmAndamentoException.class);
        verify(sessaoTrabalhoRepository, never()).save(any());
    }

    @Test
    void iniciarComCronometroJaAbertoEmOutraTarefaLancaExcecao() {
        Card outroCard = new Card(card.getColuna(), "Outra tarefa", null, 2048.0, null, null, null, autor);
        ReflectionTestUtils.setField(outroCard, "id", 20L);
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor))
                .thenReturn(Optional.of(new SessaoTrabalho(outroCard, autor, Instant.parse("2026-01-13T10:00:00Z"))));

        assertThatThrownBy(() -> service.iniciar(10L, autor)).isInstanceOf(CronometroJaEmAndamentoException.class);
        verify(sessaoTrabalhoRepository, never()).save(any());
    }

    @Test
    void pausarFechaASessaoAbertaEGeraEventoComOsMinutos() {
        SessaoTrabalho aberta = new SessaoTrabalho(card, autor, Instant.parse("2026-01-13T11:30:00Z"));
        // 1ª chamada (dentro de pausar()): a sessão ainda está aberta. 2ª chamada (dentro de
        // status()): já reflete que ela acabou de ser fechada, como o banco faria.
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.of(aberta), Optional.empty());
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of(aberta));

        CronometroResponse resposta = service.pausar(10L, autor);

        assertThat(aberta.getFim()).isEqualTo(RELOGIO_FIXO.instant());
        assertThat(resposta.iniciadoEm()).isNull();
        assertThat(resposta.totalMinutosFechados()).isEqualTo(30);
        var eventoCaptor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(eventoCaptor.capture());
        assertThat(eventoCaptor.getValue().getTipo()).isEqualTo(TipoEventoCard.PAUSOU_TRABALHO);
        assertThat(eventoCaptor.getValue().getPara()).isEqualTo("30 min");
    }

    @Test
    void pausarSemSessaoAbertaLancaExcecao() {
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.pausar(10L, autor)).isInstanceOf(CronometroNaoIniciadoException.class);
    }

    @Test
    void finalizarFechaASessaoAbertaGravaADescricaoEGeraEvento() {
        SessaoTrabalho aberta = new SessaoTrabalho(card, autor, Instant.parse("2026-01-13T11:00:00Z"));
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.of(aberta));
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of(aberta));
        when(cardRepository.save(card)).thenReturn(card);

        CronometroResponse resposta = service.finalizar(10L, "Corrigido e testado", autor);

        assertThat(aberta.getFim()).isEqualTo(RELOGIO_FIXO.instant());
        assertThat(resposta.descricaoConclusao()).isEqualTo("Corrigido e testado");
        assertThat(resposta.concluidoEm()).isEqualTo(RELOGIO_FIXO.instant());
        assertThat(resposta.totalMinutosFechados()).isEqualTo(60);
        var eventoCaptor = ArgumentCaptor.forClass(CardEvento.class);
        verify(cardEventoRepository).save(eventoCaptor.capture());
        assertThat(eventoCaptor.getValue().getTipo()).isEqualTo(TipoEventoCard.FINALIZOU_TRABALHO);
        assertThat(eventoCaptor.getValue().getDe()).isEqualTo("60 min");
        assertThat(eventoCaptor.getValue().getPara()).isEqualTo("Corrigido e testado");
    }

    @Test
    void finalizarSemNuncaTerIniciadoAindaFuncionaComZeroMinutos() {
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());
        when(cardRepository.save(card)).thenReturn(card);

        CronometroResponse resposta = service.finalizar(10L, "Feito rapidinho, nem precisei do cronômetro", autor);

        assertThat(resposta.totalMinutosFechados()).isZero();
        assertThat(resposta.descricaoConclusao()).isEqualTo("Feito rapidinho, nem precisei do cronômetro");
    }

    @Test
    void finalizarComTarefaJaFinalizadaLancaExcecao() {
        card.finalizar("Já tinha finalizado", Instant.parse("2026-01-12T18:00:00Z"));

        assertThatThrownBy(() -> service.finalizar(10L, "De novo", autor)).isInstanceOf(CronometroJaEmAndamentoException.class);
        verify(cardEventoRepository, never()).save(any());
    }

    @Test
    void consultarCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.consultar(999L, autor)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void consultarAtivoComSessaoAbertaRetornaOCardEOProjeto() {
        SessaoTrabalho aberta = new SessaoTrabalho(card, autor, Instant.parse("2026-01-13T11:00:00Z"));
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor)).thenReturn(Optional.of(aberta));
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());

        Optional<CronometroAtivoResponse> resposta = service.consultarAtivo(autor);

        assertThat(resposta).isPresent();
        assertThat(resposta.get().cardId()).isEqualTo(10L);
        assertThat(resposta.get().cardTitulo()).isEqualTo("Corrigir bug");
        assertThat(resposta.get().projetoId()).isEqualTo(5L);
        assertThat(resposta.get().iniciadoEm()).isEqualTo(Instant.parse("2026-01-13T11:00:00Z"));
        assertThat(resposta.get().totalMinutosFechados()).isZero();
    }

    @Test
    void consultarAtivoSemSessaoAbertaRetornaVazio() {
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(autor)).thenReturn(Optional.empty());

        assertThat(service.consultarAtivo(autor)).isEmpty();
    }

    @Test
    void semAcessoAoProjetoDoCardTodasAsAcoesLancam404SemMudarNada() {
        Usuario forasteiro = usuarioComId(2L);
        when(projetoService.usuarioPodeVer(5L, forasteiro)).thenReturn(false);

        assertThatThrownBy(() -> service.consultar(10L, forasteiro)).isInstanceOf(RecursoNaoEncontradoException.class);
        assertThatThrownBy(() -> service.iniciar(10L, forasteiro)).isInstanceOf(RecursoNaoEncontradoException.class);
        assertThatThrownBy(() -> service.pausar(10L, forasteiro)).isInstanceOf(RecursoNaoEncontradoException.class);
        assertThatThrownBy(() -> service.finalizar(10L, "Descrição", forasteiro)).isInstanceOf(RecursoNaoEncontradoException.class);

        assertThat(card.getConcluidoEm()).isNull();
        verify(sessaoTrabalhoRepository, never()).save(any());
        verify(cardRepository, never()).save(any());
        verify(cardEventoRepository, never()).save(any());
    }

    @Test
    void membroDoProjetoConsultaNormalmente() {
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());

        assertThat(service.consultar(10L, autor).cardId()).isEqualTo(10L);
    }

    @Test
    void responsavelForaDoProjetoAindaConsultaEIniciaOCronometro() {
        Usuario responsavel = usuarioComId(3L);
        ReflectionTestUtils.setField(card, "responsavel", responsavel);
        lenient().when(projetoService.usuarioPodeVer(5L, responsavel)).thenReturn(false);
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNull(responsavel)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());
        when(sessaoTrabalhoRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.consultar(10L, responsavel).cardId()).isEqualTo(10L);
        service.iniciar(10L, responsavel);

        verify(sessaoTrabalhoRepository).save(any());
    }

    @Test
    void naoResponsavelForaDoProjetoContinuaComNegativa404MesmoHavendoOutroResponsavel() {
        ReflectionTestUtils.setField(card, "responsavel", usuarioComId(3L));
        Usuario forasteiro = usuarioComId(2L);
        when(projetoService.usuarioPodeVer(5L, forasteiro)).thenReturn(false);

        assertThatThrownBy(() -> service.iniciar(10L, forasteiro)).isInstanceOf(RecursoNaoEncontradoException.class);

        verify(sessaoTrabalhoRepository, never()).save(any());
        verify(cardEventoRepository, never()).save(any());
    }

    @Test
    void membroQueNaoEResponsavelContinuaConsultando() {
        ReflectionTestUtils.setField(card, "responsavel", usuarioComId(3L));
        when(sessaoTrabalhoRepository.findByCardAndFimIsNull(card)).thenReturn(Optional.empty());
        when(sessaoTrabalhoRepository.findByCardOrderByInicioAsc(card)).thenReturn(List.of());

        assertThat(service.consultar(10L, autor).cardId()).isEqualTo(10L);
    }
}
