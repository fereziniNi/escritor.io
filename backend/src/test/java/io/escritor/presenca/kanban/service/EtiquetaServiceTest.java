package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroProjetoException;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.EtiquetaRepository;
import java.time.LocalDate;
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
    private ProjetoRepository projetoRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private CardEtiquetaRepository cardEtiquetaRepository;

    private EtiquetaService service;

    private static Projeto projetoComId(Long id) {
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    private static Coluna colunaComId(Long id, Projeto projeto) {
        Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
        ReflectionTestUtils.setField(coluna, "id", id);
        return coluna;
    }

    private static Etiqueta etiquetaComId(Long id, Projeto projeto) {
        Etiqueta etiqueta = new Etiqueta(projeto, "Urgente", "#FF0000");
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
        service = new EtiquetaService(etiquetaRepository, projetoRepository, cardRepository, cardEtiquetaRepository);
    }

    @Test
    void criaEtiquetaNoProjeto() {
        Projeto projeto = projetoComId(1L);
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(etiquetaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "Urgente", "#FF0000");

        assertThat(resposta.nome()).isEqualTo("Urgente");
        assertThat(resposta.cor()).isEqualTo("#FF0000");
        assertThat(resposta.projetoId()).isEqualTo(1L);
    }

    @Test
    void criarEmProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99L, "Urgente", "#FF0000")).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void listaEtiquetasDoProjeto() {
        Projeto projeto = projetoComId(1L);
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(etiquetaRepository.findByProjetoOrderByNomeAsc(projeto))
                .thenReturn(java.util.List.of(etiquetaComId(2L, projeto)));

        var resposta = service.listar(1L);

        assertThat(resposta).hasSize(1);
        assertThat(resposta.get(0).nome()).isEqualTo("Urgente");
    }

    @Test
    void listarDeProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listar(99L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void aplicaEtiquetaDoMesmoProjetoAoCard() {
        Projeto projeto = projetoComId(1L);
        Coluna coluna = colunaComId(5L, projeto);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, projeto);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));
        when(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).thenReturn(false);

        var resposta = service.aplicar(10L, 2L);

        assertThat(resposta.id()).isEqualTo(2L);
        verify(cardEtiquetaRepository).save(any(CardEtiqueta.class));
    }

    @Test
    void aplicarEtiquetaJaAplicadaEIdempotente() {
        Projeto projeto = projetoComId(1L);
        Coluna coluna = colunaComId(5L, projeto);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, projeto);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));
        when(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).thenReturn(true);

        service.aplicar(10L, 2L);

        verify(cardEtiquetaRepository, never()).save(any());
    }

    @Test
    void aplicarEtiquetaDeOutroProjetoLancaExcecao() {
        Projeto projetoDoCard = projetoComId(1L);
        Projeto projetoDaEtiqueta = projetoComId(2L);
        Coluna coluna = colunaComId(5L, projetoDoCard);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(3L, projetoDaEtiqueta);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(3L)).thenReturn(Optional.of(etiqueta));

        assertThatThrownBy(() -> service.aplicar(10L, 3L)).isInstanceOf(EtiquetaDeOutroProjetoException.class);

        verify(cardEtiquetaRepository, never()).save(any());
    }

    @Test
    void aplicarEmCardInexistenteLancaRecursoNaoEncontrado() {
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.aplicar(999L, 2L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void aplicarEtiquetaInexistenteLancaRecursoNaoEncontrado() {
        Projeto projeto = projetoComId(1L);
        Coluna coluna = colunaComId(5L, projeto);
        Card card = cardComId(10L, coluna);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.aplicar(10L, 999L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void removeEtiquetaDoCard() {
        Projeto projeto = projetoComId(1L);
        Coluna coluna = colunaComId(5L, projeto);
        Card card = cardComId(10L, coluna);
        Etiqueta etiqueta = etiquetaComId(2L, projeto);
        when(cardRepository.findById(10L)).thenReturn(Optional.of(card));
        when(etiquetaRepository.findById(2L)).thenReturn(Optional.of(etiqueta));

        service.remover(10L, 2L);

        verify(cardEtiquetaRepository).deleteByCardAndEtiqueta(card, etiqueta);
    }
}
