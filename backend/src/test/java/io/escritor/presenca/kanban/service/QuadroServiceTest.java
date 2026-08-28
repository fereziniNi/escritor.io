package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.ProjetoEquipe;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.NomeQuadroObrigatorioException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.QuadroSemVinculoException;
import io.escritor.presenca.kanban.repository.CardEtiquetaRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import java.time.LocalDate;
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
class QuadroServiceTest {

    @Mock
    private QuadroRepository quadroRepository;

    @Mock
    private MembroEquipeRepository membroEquipeRepository;

    @Mock
    private ProjetoEquipeRepository projetoEquipeRepository;

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private EquipeRepository equipeRepository;

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private CardEtiquetaRepository cardEtiquetaRepository;

    private final Usuario usuario = usuarioComId(1L);
    private final Equipe equipeDoUsuario = equipeComId(10L);
    private final Equipe outraEquipe = equipeComId(20L);

    private QuadroService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Equipe equipeComId(Long id) {
        Equipe equipe = new Equipe("Equipe " + id, null);
        ReflectionTestUtils.setField(equipe, "id", id);
        return equipe;
    }

    private static Projeto projetoComId(Long id) {
        Projeto projeto = new Projeto("Projeto " + id, "Cliente", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    @BeforeEach
    void setUp() {
        service = new QuadroService(
                quadroRepository,
                membroEquipeRepository,
                projetoEquipeRepository,
                projetoRepository,
                equipeRepository,
                colunaRepository,
                cardRepository,
                cardEtiquetaRepository);
    }

    @Test
    void listaQuadroDaEquipeDoUsuario() {
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        Quadro quadroDaEquipe = new Quadro("Backlog", null, equipeDoUsuario);
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDaEquipe));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).nome()).isEqualTo("Backlog");
    }

    @Test
    void naoListaQuadroDeEquipeQueUsuarioNaoParticipa() {
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        Quadro quadroDeOutraEquipe = new Quadro("Interno", null, outraEquipe);
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDeOutraEquipe));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).isEmpty();
    }

    @Test
    void listaQuadroDeProjetoVinculadoAEquipeDoUsuario() {
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        Projeto projeto = projetoComId(100L);
        Quadro quadroDoProjeto = new Quadro("Sprint atual", projeto, null);
        when(projetoEquipeRepository.findByEquipeIn(List.of(equipeDoUsuario)))
                .thenReturn(List.of(new ProjetoEquipe(projeto, equipeDoUsuario)));
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDoProjeto));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).nome()).isEqualTo("Sprint atual");
    }

    @Test
    void usuarioSemEquipeNaoVeNenhumQuadro() {
        when(membroEquipeRepository.findByUsuario(usuario)).thenReturn(List.of());
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(new Quadro("Backlog", null, outraEquipe)));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).isEmpty();
    }

    @Test
    void criaQuadroDeEquipe() {
        when(equipeRepository.findById(10L)).thenReturn(Optional.of(equipeDoUsuario));
        when(quadroRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar("Backlog", null, 10L);

        assertThat(resposta.nome()).isEqualTo("Backlog");
        assertThat(resposta.equipeId()).isEqualTo(10L);
        assertThat(resposta.projetoId()).isNull();
    }

    @Test
    void criaQuadroDeProjeto() {
        Projeto projeto = projetoComId(100L);
        when(projetoRepository.findById(100L)).thenReturn(Optional.of(projeto));
        when(quadroRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar("Sprint atual", 100L, null);

        assertThat(resposta.projetoId()).isEqualTo(100L);
        assertThat(resposta.equipeId()).isNull();
    }

    @Test
    void criarComProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar("Backlog", 999L, null))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(quadroRepository, never()).save(any());
    }

    @Test
    void criarComEquipeInexistenteLancaRecursoNaoEncontrado() {
        when(equipeRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar("Backlog", null, 999L))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void criarSemProjetoNemEquipeLancaExcecao() {
        assertThatThrownBy(() -> service.criar("Órfão", null, null)).isInstanceOf(QuadroSemVinculoException.class);

        verify(quadroRepository, never()).save(any());
    }

    @Test
    void criarComNomeEmBrancoLancaExcecao() {
        when(equipeRepository.findById(10L)).thenReturn(Optional.of(equipeDoUsuario));

        assertThatThrownBy(() -> service.criar("   ", null, 10L)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }

    @Test
    void buscarDetalheDeQuadroVisivelTrazColunasECards() {
        Quadro quadro = new Quadro("Backlog", null, equipeDoUsuario);
        ReflectionTestUtils.setField(quadro, "id", 1L);
        Coluna coluna = new Coluna(quadro, "A fazer", 0, 3);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
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
    }

    @Test
    void buscarDetalheTrazEtiquetasAplicadasNoCard() {
        Quadro quadro = new Quadro("Backlog", null, equipeDoUsuario);
        ReflectionTestUtils.setField(quadro, "id", 1L);
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
        ReflectionTestUtils.setField(coluna, "id", 5L);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);
        Etiqueta etiqueta = new Etiqueta(quadro, "Urgente", "#FF0000");
        ReflectionTestUtils.setField(etiqueta, "id", 2L);

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
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
        Quadro quadro = new Quadro("Interno", null, outraEquipe);
        ReflectionTestUtils.setField(quadro, "id", 1L);

        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.buscarDetalhe(1L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void buscarDetalheDeQuadroInexistenteLancaRecursoNaoEncontrado() {
        when(quadroRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.buscarDetalhe(99L, usuario)).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
