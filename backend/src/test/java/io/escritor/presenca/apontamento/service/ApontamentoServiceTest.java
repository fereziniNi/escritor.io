package io.escritor.presenca.apontamento.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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

    private final Instant agora = Instant.parse("2026-01-15T12:00:00Z");
    private final Clock clock = Clock.fixed(agora, ZoneOffset.UTC);

    private final Usuario usuario = usuarioComId(1L);
    private final Card card = cardComId(5L);

    private ApontamentoService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
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
        service = new ApontamentoService(apontamentoRepository, cardRepository, clock);
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
}
