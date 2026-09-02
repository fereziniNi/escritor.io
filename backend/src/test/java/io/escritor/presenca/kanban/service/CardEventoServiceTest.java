package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CardEventoServiceTest {

    @Mock
    private CardRepository cardRepository;

    @Mock
    private CardEventoRepository cardEventoRepository;

    @Mock
    private ProjetoService projetoService;

    private CardEventoService service;

    private static Projeto projetoComId(Long id) {
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    private static Card cardComId(Long id, Projeto projeto, Usuario criadoPor) {
        Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @BeforeEach
    void setUp() {
        service = new CardEventoService(cardRepository, cardEventoRepository, projetoService);
    }

    @Test
    void listaEventosEmOrdemCronologicaQuandoUsuarioTemAcesso() {
        Usuario criadoPor = usuarioComId(1L);
        Projeto projeto = projetoComId(10L);
        Card card = cardComId(5L, projeto, criadoPor);
        Usuario usuario = usuarioComId(2L);
        CardEvento criacao = new CardEvento(card, criadoPor, TipoEventoCard.CRIACAO, null, "A fazer");
        CardEvento mudanca = new CardEvento(card, criadoPor, TipoEventoCard.MUDANCA_COLUNA, "A fazer", "Em progresso");
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(projetoService.usuarioPodeVer(10L, usuario)).thenReturn(true);
        when(cardEventoRepository.findByCardOrderByCriadoEmAsc(card)).thenReturn(List.of(criacao, mudanca));

        var resposta = service.listar(5L, usuario);

        assertThat(resposta).hasSize(2);
        assertThat(resposta.get(0).tipo()).isEqualTo("CRIACAO");
        assertThat(resposta.get(1).tipo()).isEqualTo("MUDANCA_COLUNA");
    }

    @Test
    void listarSemAcessoAoProjetoLancaAcessoNegado() {
        Usuario criadoPor = usuarioComId(1L);
        Projeto projeto = projetoComId(10L);
        Card card = cardComId(5L, projeto, criadoPor);
        Usuario semAcesso = usuarioComId(3L);
        when(cardRepository.findById(5L)).thenReturn(Optional.of(card));
        when(projetoService.usuarioPodeVer(10L, semAcesso)).thenReturn(false);

        assertThatThrownBy(() -> service.listar(5L, semAcesso)).isInstanceOf(AcessoNegadoException.class);

        verify(cardEventoRepository, never()).findByCardOrderByCriadoEmAsc(ArgumentMatchers.any());
    }

    @Test
    void listarEmCardInexistenteLancaRecursoNaoEncontrado() {
        Usuario usuario = usuarioComId(2L);
        when(cardRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listar(999L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
