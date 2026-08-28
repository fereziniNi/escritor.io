package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.CalculadoraPosicao;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.TituloCardObrigatorioException;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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

    private final Coluna coluna = colunaComId(1L);
    private final Usuario criadoPor = usuarioComId(1L);

    private CardService service;

    private static Coluna colunaComId(Long id) {
        Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
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
        service = new CardService(cardRepository, colunaRepository, usuarioRepository);
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
    void moverParaColunaVaziaUsaPosicaoBase() {
        Coluna destino = colunaComId(2L);
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(2L)).thenReturn(Optional.of(destino));
        when(cardRepository.findByColunaOrderByPosicaoAsc(destino)).thenReturn(List.of());
        when(cardRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.mover(10L, 2L, 0);

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

        var resposta = service.mover(10L, 2L, 1);

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

        var resposta = service.mover(10L, 1L, 0);

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

        service.mover(10L, 2L, 1);

        verify(cardRepository, org.mockito.Mockito.times(1)).save(any());
        verify(cardRepository, never()).save(org.mockito.ArgumentMatchers.eq(vizinho));
    }

    @Test
    void moverCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.mover(999L, 2L, 0)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void moverParaColunaInexistenteLancaRecursoNaoEncontrado() {
        Card card = cardComId(10L, coluna, 1024.0);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(colunaRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.mover(10L, 99L, 0)).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
