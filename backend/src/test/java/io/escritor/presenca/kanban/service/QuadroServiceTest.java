package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.NomeQuadroObrigatorioException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.MembroQuadroRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import io.escritor.presenca.kanban.web.AdicionarMembroQuadroRequest;
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
class QuadroServiceTest {

    @Mock
    private QuadroRepository quadroRepository;

    @Mock
    private MembroQuadroRepository membroQuadroRepository;

    @Mock
    private ProjetoRepository projetoRepository;

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

    private QuadroService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Projeto projetoComId(Long id) {
        Projeto projeto = new Projeto("Projeto " + id, "Cliente", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    private static Quadro quadroComId(Long id, String nome) {
        Quadro quadro = new Quadro(nome, null);
        ReflectionTestUtils.setField(quadro, "id", id);
        return quadro;
    }

    private static MembroQuadro membroQuadro(Quadro quadro, Usuario usuario) {
        return new MembroQuadro(quadro, usuario);
    }

    @BeforeEach
    void setUp() {
        service = new QuadroService(
                quadroRepository,
                membroQuadroRepository,
                projetoRepository,
                usuarioRepository,
                colunaRepository,
                cardRepository,
                cardEtiquetaRepository);
    }

    @Test
    void listaQuadroDoQualUsuarioEMembro() {
        Quadro quadroDoUsuario = quadroComId(1L, "Backlog");
        when(membroQuadroRepository.findByUsuario(usuario)).thenReturn(List.of(membroQuadro(quadroDoUsuario, usuario)));
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDoUsuario));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).nome()).isEqualTo("Backlog");
    }

    @Test
    void naoListaQuadroDoQualUsuarioNaoEMembro() {
        Quadro quadroDeOutroUsuario = quadroComId(1L, "Interno");
        when(membroQuadroRepository.findByUsuario(usuario)).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDeOutroUsuario));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).isEmpty();
    }

    @Test
    void criaQuadroSemProjetoEJaAdicionaCriadorComoMembro() {
        when(quadroRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar("Backlog", null, usuario);

        assertThat(resposta.nome()).isEqualTo("Backlog");
        assertThat(resposta.projetoId()).isNull();
        ArgumentCaptor<MembroQuadro> membroCaptor = ArgumentCaptor.forClass(MembroQuadro.class);
        verify(membroQuadroRepository).save(membroCaptor.capture());
        assertThat(membroCaptor.getValue().getUsuario()).isSameAs(usuario);
    }

    @Test
    void criaQuadroDeProjeto() {
        Projeto projeto = projetoComId(100L);
        when(projetoRepository.findById(100L)).thenReturn(Optional.of(projeto));
        when(quadroRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar("Sprint atual", 100L, usuario);

        assertThat(resposta.projetoId()).isEqualTo(100L);
    }

    @Test
    void criarComProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar("Backlog", 999L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);

        verify(quadroRepository, never()).save(any());
    }

    @Test
    void criarComNomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> service.criar("   ", null, usuario)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }

    @Test
    void adicionarMembroNovoPersiste() {
        Quadro quadro = quadroComId(1L, "Backlog");
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outroUsuario));
        when(membroQuadroRepository.existsByQuadroAndUsuario(quadro, outroUsuario)).thenReturn(false);

        service.adicionarMembro(1L, new AdicionarMembroQuadroRequest(2L));

        verify(membroQuadroRepository).save(any(MembroQuadro.class));
    }

    @Test
    void adicionarMembroJaExistenteNaoDuplica() {
        Quadro quadro = quadroComId(1L, "Backlog");
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outroUsuario));
        when(membroQuadroRepository.existsByQuadroAndUsuario(quadro, outroUsuario)).thenReturn(true);

        service.adicionarMembro(1L, new AdicionarMembroQuadroRequest(2L));

        verify(membroQuadroRepository, never()).save(any());
    }

    @Test
    void adicionarMembroComUsuarioInexistenteLancaRecursoNaoEncontrado() {
        Quadro quadro = quadroComId(1L, "Backlog");
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.adicionarMembro(1L, new AdicionarMembroQuadroRequest(999L)))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void buscarDetalheDeQuadroVisivelTrazColunasCardsEMembros() {
        Quadro quadro = quadroComId(1L, "Backlog");
        Coluna coluna = new Coluna(quadro, "A fazer", 0, 3);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroQuadroRepository.findByUsuario(usuario)).thenReturn(List.of(membroQuadro(quadro, usuario)));
        when(membroQuadroRepository.findByQuadro(quadro)).thenReturn(List.of(membroQuadro(quadro, usuario)));
        when(colunaRepository.findByQuadroOrderByOrdemAsc(quadro)).thenReturn(List.of(coluna));
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
        Quadro quadro = quadroComId(1L, "Backlog");
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);
        Etiqueta etiqueta = new Etiqueta(quadro, "Urgente", "#FF0000");
        ReflectionTestUtils.setField(etiqueta, "id", 2L);

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroQuadroRepository.findByUsuario(usuario)).thenReturn(List.of(membroQuadro(quadro, usuario)));
        when(membroQuadroRepository.findByQuadro(quadro)).thenReturn(List.of(membroQuadro(quadro, usuario)));
        when(colunaRepository.findByQuadroOrderByOrdemAsc(quadro)).thenReturn(List.of(coluna));
        when(cardRepository.findByColunaOrderByPosicaoAsc(coluna)).thenReturn(List.of(card));
        when(cardEtiquetaRepository.findByCard(card)).thenReturn(List.of(new CardEtiqueta(card, etiqueta)));

        var detalhe = service.buscarDetalhe(1L, usuario);

        var etiquetasDoCard = detalhe.colunas().get(0).cards().get(0).etiquetas();
        assertThat(etiquetasDoCard).hasSize(1);
        assertThat(etiquetasDoCard.get(0).nome()).isEqualTo("Urgente");
        assertThat(etiquetasDoCard.get(0).cor()).isEqualTo("#FF0000");
    }

    @Test
    void buscarDetalheDeQuadroNaoVisivelLancaRecursoNaoEncontrado() {
        Quadro quadro = quadroComId(1L, "Interno");

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroQuadroRepository.findByUsuario(usuario)).thenReturn(List.of());

        assertThatThrownBy(() -> service.buscarDetalhe(1L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void buscarDetalheDeQuadroInexistenteLancaRecursoNaoEncontrado() {
        when(quadroRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscarDetalhe(99L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
