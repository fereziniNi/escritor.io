package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroQuadroException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.EtiquetaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
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
class EtiquetaServiceTest {

    @Mock
    private EtiquetaRepository etiquetaRepository;

    @Mock
    private QuadroRepository quadroRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private CardEtiquetaRepository cardEtiquetaRepository;

    private EtiquetaService service;

    private static Quadro quadroComId(Long id) {
        Quadro quadro = new Quadro("Backlog", null);
        ReflectionTestUtils.setField(quadro, "id", id);
        return quadro;
    }

    private static Coluna colunaComId(Long id, Quadro quadro) {
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
        ReflectionTestUtils.setField(coluna, "id", id);
        return coluna;
    }

    private static Etiqueta etiquetaComId(Long id, Quadro quadro) {
        Etiqueta etiqueta = new Etiqueta(quadro, "Urgente", "#FF0000");
        ReflectionTestUtils.setField(etiqueta, "id", id);
        return etiqueta;
    }

    private static Card cardComId(Long id, Coluna coluna) {
        Usuario criadoPor = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new EtiquetaService(etiquetaRepository, quadroRepository, cardRepository, cardEtiquetaRepository);
    }

    @Test
    void criaEtiquetaNoQuadro() {
        Quadro quadro = quadroComId(1L);
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(etiquetaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "Urgente", "#FF0000");

        assertThat(resposta.nome()).isEqualTo("Urgente");
        assertThat(resposta.cor()).isEqualTo("#FF0000");
        assertThat(resposta.quadroId()).isEqualTo(1L);
    }

    @Test
    void criarEmQuadroInexistenteLancaRecursoNaoEncontrado() {
        when(quadroRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99L, "Urgente", "#FF0000")).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void listaEtiquetasDoQuadro() {
        Quadro quadro = quadroComId(1L);
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(etiquetaRepository.findByQuadroOrderByNomeAsc(quadro))
                .thenReturn(java.util.List.of(etiquetaComId(2L, quadro)));

        var resposta = service.listar(1L);

        assertThat(resposta).hasSize(1);
        assertThat(resposta.get(0).nome()).isEqualTo("Urgente");
    }

    @Test
    void listarDeQuadroInexistenteLancaRecursoNaoEncontrado() {
        when(quadroRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listar(99L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void aplicaEtiquetaDoMesmoQuadroAoCard() {
        Quadro quadro = quadroComId(1L);
        Coluna coluna = colunaComId(5L, quadro);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, quadro);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));
        when(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).thenReturn(false);

        var resposta = service.aplicar(10L, 2L);

        assertThat(resposta.id()).isEqualTo(2L);
        verify(cardEtiquetaRepository).save(any(CardEtiqueta.class));
    }

    @Test
    void aplicarEtiquetaJaAplicadaEIdempotente() {
        Quadro quadro = quadroComId(1L);
        Coluna coluna = colunaComId(5L, quadro);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, quadro);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));
        when(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).thenReturn(true);

        service.aplicar(10L, 2L);

        verify(cardEtiquetaRepository, never()).save(any());
    }

    @Test
    void aplicarEtiquetaDeOutroQuadroLancaExcecao() {
        Quadro quadroDoCard = quadroComId(1L);
        Quadro quadroDaEtiqueta = quadroComId(2L);
        Coluna coluna = colunaComId(5L, quadroDoCard);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(3L, quadroDaEtiqueta);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(3L)).thenReturn(Optional.of(etiqueta));

        assertThatThrownBy(() -> service.aplicar(10L, 3L)).isInstanceOf(EtiquetaDeOutroQuadroException.class);

        verify(cardEtiquetaRepository, never()).save(any());
    }

    @Test
    void aplicarEmCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.aplicar(999L, 2L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void aplicarEtiquetaInexistenteLancaRecursoNaoEncontrado() {
        Quadro quadro = quadroComId(1L);
        Coluna coluna = colunaComId(5L, quadro);
        Card card = cardComId(10L, coluna);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.aplicar(10L, 999L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void removeEtiquetaDoCard() {
        Quadro quadro = quadroComId(1L);
        Coluna coluna = colunaComId(5L, quadro);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, quadro);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));

        service.remover(10L, 2L);

        verify(cardEtiquetaRepository).deleteByCardAndEtiqueta(card, etiqueta);
    }
}
