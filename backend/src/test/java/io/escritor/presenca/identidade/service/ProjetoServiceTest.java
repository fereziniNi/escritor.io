package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AdicionarMembroProjetoRequest;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjetoServiceTest {

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private MembroProjetoRepository membroProjetoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private CardEtiquetaRepository cardEtiquetaRepository;

    private final Usuario usuario = usuarioComId(1L);
    private final Usuario outroUsuario = usuarioComId(2L);

    private ProjetoService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Projeto projetoComId(Long id, String nome) {
        Projeto projeto = new Projeto(nome, "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    private static MembroProjeto membroProjeto(Projeto projeto, Usuario usuario) {
        return new MembroProjeto(projeto, usuario);
    }

    @BeforeEach
    void setUp() {
        service = new ProjetoService(
                projetoRepository, membroProjetoRepository, usuarioRepository, colunaRepository, cardRepository, cardEtiquetaRepository);
    }

    @Test
    void criaProjetoEJaAdicionaCriadorComoMembro() {
        when(projetoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(
                new CriarProjetoRequest("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null), usuario);

        assertThat(resposta.nome()).isEqualTo("Portal");
        assertThat(resposta.cliente()).isEqualTo("Acme");
        assertThat(resposta.status()).isEqualTo(StatusProjeto.ATIVO);
        ArgumentCaptor<MembroProjeto> membroCaptor = ArgumentCaptor.forClass(MembroProjeto.class);
        verify(membroProjetoRepository).save(membroCaptor.capture());
        assertThat(membroCaptor.getValue().getUsuario()).isSameAs(usuario);
    }

    @Test
    void listaProjetoDoQualUsuarioEMembro() {
        Projeto projetoDoUsuario = projetoComId(1L, "Backlog");
        when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of(membroProjeto(projetoDoUsuario, usuario)));
        when(projetoRepository.findAll()).thenReturn(List.of(projetoDoUsuario));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).nome()).isEqualTo("Backlog");
    }

    @Test
    void naoListaProjetoDoQualUsuarioNaoEMembro() {
        Projeto projetoDeOutroUsuario = projetoComId(1L, "Interno");
        when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of());
        when(projetoRepository.findAll()).thenReturn(List.of(projetoDeOutroUsuario));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).isEmpty();
    }

    @Test
    void adicionarMembroNovoPersiste() {
        Projeto projeto = projetoComId(1L, "Backlog");
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outroUsuario));
        when(membroProjetoRepository.existsByProjetoAndUsuario(projeto, outroUsuario)).thenReturn(false);

        service.adicionarMembro(1L, new AdicionarMembroProjetoRequest(2L));

        verify(membroProjetoRepository).save(any(MembroProjeto.class));
    }

    @Test
    void adicionarMembroJaExistenteNaoDuplica() {
        Projeto projeto = projetoComId(1L, "Backlog");
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outroUsuario));
        when(membroProjetoRepository.existsByProjetoAndUsuario(projeto, outroUsuario)).thenReturn(true);

        service.adicionarMembro(1L, new AdicionarMembroProjetoRequest(2L));

        verify(membroProjetoRepository, never()).save(any());
    }

    @Test
    void adicionarMembroComUsuarioInexistenteLancaRecursoNaoEncontrado() {
        Projeto projeto = projetoComId(1L, "Backlog");
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.adicionarMembro(1L, new AdicionarMembroProjetoRequest(999L)))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void buscarDetalheDeProjetoVisivelTrazColunasCardsEMembros() {
        Projeto projeto = projetoComId(1L, "Backlog");
        Coluna coluna = new Coluna(projeto, "A fazer", 0, 3);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);

        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of(membroProjeto(projeto, usuario)));
        when(membroProjetoRepository.findByProjeto(projeto)).thenReturn(List.of(membroProjeto(projeto, usuario)));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(coluna));
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(card));
        when(cardEtiquetaRepository.findByCard(card)).thenReturn(List.of());

        var detalhe = service.buscarDetalhe(1L, usuario);

        assertThat(detalhe.nome()).isEqualTo("Backlog");
        assertThat(detalhe.colunas()).hasSize(1);
        assertThat(detalhe.colunas().get(0).nome()).isEqualTo("A fazer");
        assertThat(detalhe.colunas().get(0).limiteWip()).isEqualTo(3);
        assertThat(detalhe.colunas().get(0).cards()).hasSize(1);
        assertThat(detalhe.colunas().get(0).cards().get(0).titulo()).isEqualTo("Corrigir bug");
        assertThat(detalhe.colunas().get(0).cards().get(0).etiquetas()).isEmpty();
        assertThat(detalhe.membros()).hasSize(1);
        assertThat(detalhe.membros().get(0).usuarioId()).isEqualTo(usuario.getId());
    }

    @Test
    void buscarDetalheTrazEtiquetasAplicadasNoCard() {
        Projeto projeto = projetoComId(1L, "Backlog");
        Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);
        Etiqueta etiqueta = new Etiqueta(projeto, "Urgente", "#FF0000");
        ReflectionTestUtils.setField(etiqueta, "id", 2L);

        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of(membroProjeto(projeto, usuario)));
        when(membroProjetoRepository.findByProjeto(projeto)).thenReturn(List.of(membroProjeto(projeto, usuario)));
        when(colunaRepository.findByProjetoOrderByOrdemAsc(projeto)).thenReturn(List.of(coluna));
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(card));
        when(cardEtiquetaRepository.findByCard(card)).thenReturn(List.of(new CardEtiqueta(card, etiqueta)));

        var detalhe = service.buscarDetalhe(1L, usuario);

        var etiquetasDoCard = detalhe.colunas().get(0).cards().get(0).etiquetas();
        assertThat(etiquetasDoCard).hasSize(1);
        assertThat(etiquetasDoCard.get(0).nome()).isEqualTo("Urgente");
        assertThat(etiquetasDoCard.get(0).cor()).isEqualTo("#FF0000");
    }

    @Test
    void buscarDetalheDeProjetoNaoVisivelLancaRecursoNaoEncontrado() {
        Projeto projeto = projetoComId(1L, "Interno");

        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of());

        assertThatThrownBy(() -> service.buscarDetalhe(1L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void buscarDetalheDeProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscarDetalhe(99L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
