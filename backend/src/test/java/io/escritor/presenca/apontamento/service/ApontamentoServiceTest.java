package io.escritor.presenca.apontamento.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.ApontamentoJaEncerradoException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApontamentoServiceTest {

    @Mock
    private ApontamentoRepository apontamentoRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private MembroEquipeRepository membroEquipeRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    private final Instant agora = Instant.parse("2026-01-15T12:00:00Z");
    private final Clock clock = Clock.fixed(agora, ZoneOffset.UTC);

    private final Usuario usuario = usuarioComId(1L);
    private final Card card = cardComId(5L);

    private ApontamentoService service;

    private static Usuario usuarioComId(Long id) {
        return usuarioComId(id, Papel.COLABORADOR);
    }

    private static Usuario usuarioComId(Long id, Papel papel) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", papel, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Card cardComId(Long id) {
        Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuarioComId(1L));
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new ApontamentoService(apontamentoRepository, cardRepository, membroEquipeRepository, usuarioRepository, clock);
    }

    @Test
    void iniciaTimerQuandoNaoHaTimerAbertoAnterior() {
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario)).thenReturn(Optional.empty());
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.iniciarTimer(5L, usuario);

        assertThat(resposta.cardId()).isEqualTo(5L);
        assertThat(resposta.usuarioId()).isEqualTo(1L);
        assertThat(resposta.inicio()).isEqualTo(agora);
        assertThat(resposta.fim()).isNull();
        assertThat(resposta.origem()).isEqualTo("TIMER");
        verify(apontamentoRepository, times(1)).save(any());
    }

    @Test
    void iniciarNovoTimerEncerraOTimerAbertoAnteriorAutomaticamente() {
        Instant inicioAntigo = agora.minus(90, ChronoUnit.MINUTES);
        Apontamento timerAberto = new Apontamento(usuario, card, inicioAntigo, null, null, OrigemApontamento.TIMER);
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario)).thenReturn(Optional.of(timerAberto));
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.iniciarTimer(5L, usuario);

        var captor = ArgumentCaptor.forClass(Apontamento.class);
        verify(apontamentoRepository, times(2)).save(captor.capture());
        Apontamento primeiroSalvo = captor.getAllValues().get(0);
        assertThat(primeiroSalvo).isSameAs(timerAberto);
        assertThat(primeiroSalvo.getFim()).isEqualTo(agora);
        assertThat(primeiroSalvo.getMinutos()).isEqualTo(90);
    }

    @Test
    void iniciarTimerEmCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.iniciarTimer(999L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void pararEncerraOTimerDoProprioUsuario() {
        Instant inicio = agora.minus(30, ChronoUnit.MINUTES);
        Apontamento timerAberto = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);
        ReflectionTestUtils.setField(timerAberto, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(timerAberto));
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.parar(7L, usuario);

        assertThat(resposta.fim()).isEqualTo(agora);
        assertThat(resposta.minutos()).isEqualTo(30);
        verify(apontamentoRepository).save(timerAberto);
    }

    @Test
    void pararApontamentoDeOutroUsuarioLancaExcecao() {
        Usuario dono = usuarioComId(1L);
        Usuario outro = usuarioComId(2L);
        Apontamento timerAberto = new Apontamento(dono, card, agora.minus(10, ChronoUnit.MINUTES), null, null, OrigemApontamento.TIMER);
        ReflectionTestUtils.setField(timerAberto, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(timerAberto));

        assertThatThrownBy(() -> service.parar(7L, outro)).isInstanceOf(ApontamentoDeOutroUsuarioException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void pararApontamentoJaEncerradoLancaExcecao() {
        Apontamento jaEncerrado = new Apontamento(
                usuario, card, agora.minus(60, ChronoUnit.MINUTES), agora.minus(30, ChronoUnit.MINUTES), null, OrigemApontamento.TIMER);
        ReflectionTestUtils.setField(jaEncerrado, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(jaEncerrado));

        assertThatThrownBy(() -> service.parar(7L, usuario)).isInstanceOf(ApontamentoJaEncerradoException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void pararApontamentoInexistenteLancaRecursoNaoEncontrado() {
        when(apontamentoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.parar(999L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void criaManualComIntervaloExplicitoCalculaMinutos() {
        Instant inicio = agora.minus(2, ChronoUnit.HOURS);
        Instant fim = agora.minus(30, ChronoUnit.MINUTES);
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criarManual(5L, inicio, fim, null, "Revisão de código", usuario);

        assertThat(resposta.inicio()).isEqualTo(inicio);
        assertThat(resposta.fim()).isEqualTo(fim);
        assertThat(resposta.minutos()).isEqualTo(90);
        assertThat(resposta.descricao()).isEqualTo("Revisão de código");
        assertThat(resposta.origem()).isEqualTo("MANUAL");
    }

    @Test
    void criaManualComMinutosDiretoSintetizaOIntervalo() {
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criarManual(5L, null, null, 120, "Pareamento", usuario);

        assertThat(resposta.fim()).isEqualTo(agora);
        assertThat(resposta.inicio()).isEqualTo(agora.minus(120, ChronoUnit.MINUTES));
        assertThat(resposta.minutos()).isEqualTo(120);
        assertThat(resposta.origem()).isEqualTo("MANUAL");
    }

    @Test
    void criarManualComMinutosEIntervaloJuntosLancaExcecao() {
        assertThatThrownBy(() -> service.criarManual(5L, agora.minus(1, ChronoUnit.HOURS), agora, 60, null, usuario))
                .isInstanceOf(LancamentoManualInvalidoException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void criarManualSemMinutosNemIntervaloCompletoLancaExcecao() {
        assertThatThrownBy(() -> service.criarManual(5L, null, null, null, null, usuario))
                .isInstanceOf(LancamentoManualInvalidoException.class);

        assertThatThrownBy(() -> service.criarManual(5L, agora.minus(1, ChronoUnit.HOURS), null, null, null, usuario))
                .isInstanceOf(LancamentoManualInvalidoException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void criarManualEmCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criarManual(999L, null, null, 60, null, usuario))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void editaOProprioApontamentoRecalculandoMinutos() {
        Instant inicioOriginal = agora.minus(2, ChronoUnit.HOURS);
        Instant fimOriginal = agora.minus(90, ChronoUnit.MINUTES);
        Apontamento existente = new Apontamento(usuario, card, inicioOriginal, fimOriginal, "Original", OrigemApontamento.MANUAL);
        ReflectionTestUtils.setField(existente, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(existente));
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        Instant novoFim = agora.minus(1, ChronoUnit.HOURS);
        var resposta = service.editar(7L, null, novoFim, "Corrigido", usuario);

        assertThat(resposta.fim()).isEqualTo(novoFim);
        assertThat(resposta.minutos()).isEqualTo(60);
        assertThat(resposta.descricao()).isEqualTo("Corrigido");
        verify(apontamentoRepository).save(existente);
    }

    @Test
    void editarApontamentoDeOutroUsuarioLancaExcecao() {
        Usuario dono = usuarioComId(1L);
        Usuario outro = usuarioComId(2L);
        Apontamento existente = new Apontamento(dono, card, agora.minus(1, ChronoUnit.HOURS), agora, null, OrigemApontamento.MANUAL);
        ReflectionTestUtils.setField(existente, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(existente));

        assertThatThrownBy(() -> service.editar(7L, null, null, "Tentando editar", outro))
                .isInstanceOf(ApontamentoDeOutroUsuarioException.class);

        verify(apontamentoRepository, never()).save(any());
    }

    @Test
    void editarApontamentoInexistenteLancaRecursoNaoEncontrado() {
        when(apontamentoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.editar(999L, null, null, "x", usuario))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void excluiOProprioApontamento() {
        Apontamento existente = new Apontamento(usuario, card, agora.minus(1, ChronoUnit.HOURS), agora, null, OrigemApontamento.MANUAL);
        ReflectionTestUtils.setField(existente, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(existente));

        service.excluir(7L, usuario);

        verify(apontamentoRepository).delete(existente);
    }

    @Test
    void excluirApontamentoDeOutroUsuarioLancaExcecao() {
        Usuario dono = usuarioComId(1L);
        Usuario outro = usuarioComId(2L);
        Apontamento existente = new Apontamento(dono, card, agora.minus(1, ChronoUnit.HOURS), agora, null, OrigemApontamento.MANUAL);
        ReflectionTestUtils.setField(existente, "id", 7L);
        when(apontamentoRepository.findById(7L)).thenReturn(Optional.of(existente));

        assertThatThrownBy(() -> service.excluir(7L, outro)).isInstanceOf(ApontamentoDeOutroUsuarioException.class);

        verify(apontamentoRepository, never()).delete(any());
    }

    @Test
    void excluirApontamentoInexistenteLancaRecursoNaoEncontrado() {
        when(apontamentoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.excluir(999L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void listaOsApontamentosDoCardMaisRecentePrimeiro() {
        Apontamento maisAntigo = new Apontamento(usuario, card, agora.minus(3, ChronoUnit.HOURS), agora.minus(2, ChronoUnit.HOURS), null, OrigemApontamento.MANUAL);
        Apontamento maisRecente = new Apontamento(usuario, card, agora.minus(1, ChronoUnit.HOURS), agora, null, OrigemApontamento.MANUAL);
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.findByCardOrderByInicioDesc(card)).thenReturn(java.util.List.of(maisRecente, maisAntigo));

        var resposta = service.listarPorCard(5L);

        assertThat(resposta).hasSize(2);
        assertThat(resposta.get(0).inicio()).isEqualTo(maisRecente.getInicio());
        assertThat(resposta.get(1).inicio()).isEqualTo(maisAntigo.getInicio());
    }

    @Test
    void listarApontamentosDeCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listarPorCard(999L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void iniciarTimerTruncaInstantParaMilissegundosPraNaoPerderPrecisaoNoRoundTripComOFrontend() {
        // Instant.now() do servidor costuma ter precisão de microssegundos/nanossegundos - o
        // frontend (S4.7, editar inline) recebe esse instante via JSON, reparseia com o JS Date
        // (só milissegundos) e reenvia num PATCH futuro. Se o inicio salvo tiver sub-milissegundos
        // não visíveis pro cliente, o fim recalculado no browser fica alguns microssegundos ANTES
        // do inicio de verdade, e Duration.toMinutes() trunca a duração 1 minuto a menos - achado
        // testando a edição inline num browser real, não um artefato de teste.
        Instant instanteComMicrossegundos = Instant.parse("2026-01-15T12:00:00.123456Z");
        Clock clockComMicrossegundos = Clock.fixed(instanteComMicrossegundos, ZoneOffset.UTC);
        ApontamentoService servicoComMicrossegundos = new ApontamentoService(
                apontamentoRepository, cardRepository, membroEquipeRepository, usuarioRepository, clockComMicrossegundos);
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario)).thenReturn(Optional.empty());
        when(apontamentoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = servicoComMicrossegundos.iniciarTimer(5L, usuario);

        assertThat(resposta.inicio().getNano() % 1_000_000).isZero();
    }

    @Test
    void colaboradorVeOsProprosApontamentosSemInformarUsuarioId() {
        Instant inicio = agora.minus(1, ChronoUnit.DAYS);
        Apontamento proprio = new Apontamento(
                usuario, card, inicio.plus(1, ChronoUnit.HOURS), inicio.plus(2, ChronoUnit.HOURS), null, OrigemApontamento.MANUAL);
        when(apontamentoRepository.findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(usuario, inicio, agora))
                .thenReturn(List.of(proprio));

        var resposta = service.listarPorUsuarioEPeriodo(null, inicio, agora, usuario);

        assertThat(resposta).hasSize(1);
        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void colaboradorVeOsProprosApontamentosInformandoOProprioIdExplicitamente() {
        Instant inicio = agora.minus(1, ChronoUnit.DAYS);
        when(apontamentoRepository.findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(usuario, inicio, agora))
                .thenReturn(List.of());

        var resposta = service.listarPorUsuarioEPeriodo(usuario.getId(), inicio, agora, usuario);

        assertThat(resposta).isEmpty();
        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void colaboradorTentandoVerApontamentosDeOutroUsuarioLancaExcecao() {
        Usuario outro = usuarioComId(2L, Papel.COLABORADOR);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outro));

        assertThatThrownBy(() -> service.listarPorUsuarioEPeriodo(2L, agora.minus(1, ChronoUnit.DAYS), agora, usuario))
                .isInstanceOf(ApontamentoDeOutroUsuarioException.class);

        verify(apontamentoRepository, never())
                .findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(any(), any(), any());
    }

    @Test
    void gestorVeApontamentosDeUmMembroDaEquipeQueLidera() {
        Usuario gestor = usuarioComId(2L, Papel.GESTOR);
        Usuario membro = usuarioComId(3L, Papel.COLABORADOR);
        Equipe equipeLiderada = new Equipe("Backend", null);
        ReflectionTestUtils.setField(equipeLiderada, "id", 10L);
        MembroEquipe vinculoLideranca = new MembroEquipe(equipeLiderada, gestor, PapelNaEquipe.LIDER);
        Instant inicio = agora.minus(1, ChronoUnit.DAYS);
        when(usuarioRepository.findById(3L)).thenReturn(Optional.of(membro));
        when(membroEquipeRepository.findByUsuarioAndPapelNaEquipe(gestor, PapelNaEquipe.LIDER)).thenReturn(List.of(vinculoLideranca));
        when(membroEquipeRepository.existsByEquipeInAndUsuario(List.of(equipeLiderada), membro)).thenReturn(true);
        when(apontamentoRepository.findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(membro, inicio, agora))
                .thenReturn(List.of());

        var resposta = service.listarPorUsuarioEPeriodo(3L, inicio, agora, gestor);

        assertThat(resposta).isEmpty();
    }

    @Test
    void gestorTentandoVerApontamentosDeUsuarioForaDasEquipesQueLideraLancaExcecao() {
        Usuario gestor = usuarioComId(2L, Papel.GESTOR);
        Usuario outroUsuario = usuarioComId(4L, Papel.COLABORADOR);
        when(usuarioRepository.findById(4L)).thenReturn(Optional.of(outroUsuario));
        when(membroEquipeRepository.findByUsuarioAndPapelNaEquipe(gestor, PapelNaEquipe.LIDER)).thenReturn(List.of());

        assertThatThrownBy(() -> service.listarPorUsuarioEPeriodo(4L, agora.minus(1, ChronoUnit.DAYS), agora, gestor))
                .isInstanceOf(ApontamentoDeOutroUsuarioException.class);

        verify(apontamentoRepository, never())
                .findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(any(), any(), any());
    }

    @Test
    void adminVeApontamentosDeQualquerUsuarioSemChecarEquipe() {
        Usuario admin = usuarioComId(9L, Papel.ADMIN);
        Usuario qualquerUsuario = usuarioComId(5L, Papel.COLABORADOR);
        Instant inicio = agora.minus(1, ChronoUnit.DAYS);
        when(usuarioRepository.findById(5L)).thenReturn(Optional.of(qualquerUsuario));
        when(apontamentoRepository.findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(qualquerUsuario, inicio, agora))
                .thenReturn(List.of());

        var resposta = service.listarPorUsuarioEPeriodo(5L, inicio, agora, admin);

        assertThat(resposta).isEmpty();
        verify(membroEquipeRepository, never()).findByUsuarioAndPapelNaEquipe(any(), any());
    }

    @Test
    void listarPorUsuarioIdInexistenteLancaRecursoNaoEncontrado() {
        Usuario admin = usuarioComId(9L, Papel.ADMIN);
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listarPorUsuarioEPeriodo(999L, agora.minus(1, ChronoUnit.DAYS), agora, admin))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
