package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.ProjetoEquipe;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuadroServiceTest {

    @Mock
    private QuadroRepository quadroRepository;

    @Mock
    private MembroEquipeRepository membroEquipeRepository;

    @Mock
    private ProjetoEquipeRepository projetoEquipeRepository;

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
        service = new QuadroService(quadroRepository, membroEquipeRepository, projetoEquipeRepository);
        when(membroEquipeRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroEquipe(equipeDoUsuario, usuario, PapelNaEquipe.MEMBRO)));
    }

    @Test
    void listaQuadroDaEquipeDoUsuario() {
        Quadro quadroDaEquipe = new Quadro("Backlog", null, equipeDoUsuario);
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDaEquipe));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).hasSize(1);
        assertThat(visiveis.get(0).nome()).isEqualTo("Backlog");
    }

    @Test
    void naoListaQuadroDeEquipeQueUsuarioNaoParticipa() {
        Quadro quadroDeOutraEquipe = new Quadro("Interno", null, outraEquipe);
        when(projetoEquipeRepository.findByEquipeIn(any())).thenReturn(List.of());
        when(quadroRepository.findAll()).thenReturn(List.of(quadroDeOutraEquipe));

        var visiveis = service.listarVisiveis(usuario);

        assertThat(visiveis).isEmpty();
    }

    @Test
    void listaQuadroDeProjetoVinculadoAEquipeDoUsuario() {
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
}
