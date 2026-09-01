package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.MembroQuadroRepository;
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

/**
 * Extraída de {@code ApontamentoService} (S4.10) - até S5.1 essa era a única lógica de "gestor vê
 * equipe" do sistema, vivendo direto dentro de um serviço de outro épico. E4 (S5.2+) precisa da
 * mesma regra em vários lugares, daí a extração antes de duplicar.
 */
@ExtendWith(MockitoExtension.class)
class VisibilidadeUsuarioServiceTest {

    @Mock
    private MembroQuadroRepository membroQuadroRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    private VisibilidadeUsuarioService service;

    private static Usuario usuarioComId(Long id, Papel papel) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", papel, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Quadro quadroComId(Long id) {
        Quadro quadro = new Quadro("Sistema " + id, null);
        ReflectionTestUtils.setField(quadro, "id", id);
        return quadro;
    }

    @BeforeEach
    void setUp() {
        service = new VisibilidadeUsuarioService(membroQuadroRepository, usuarioRepository);
    }

    @Test
    void usuarioSempreVeOsProprios() {
        Usuario usuario = usuarioComId(1L, Papel.COLABORADOR);

        assertThat(service.podeVer(usuario, usuario)).isTrue();
    }

    @Test
    void colaboradorNaoVeDadosDeOutroUsuario() {
        Usuario colaborador = usuarioComId(1L, Papel.COLABORADOR);
        Usuario outro = usuarioComId(2L, Papel.COLABORADOR);

        assertThat(service.podeVer(colaborador, outro)).isFalse();
    }

    @Test
    void adminVeQualquerUsuarioSemChecarQuadro() {
        Usuario admin = usuarioComId(9L, Papel.ADMIN);
        Usuario qualquerUsuario = usuarioComId(2L, Papel.COLABORADOR);

        assertThat(service.podeVer(admin, qualquerUsuario)).isTrue();
    }

    @Test
    void gestorVeMembroDoMesmoQuadro() {
        Usuario gestor = usuarioComId(2L, Papel.GESTOR);
        Usuario membro = usuarioComId(3L, Papel.COLABORADOR);
        Quadro quadroComum = quadroComId(10L);
        when(membroQuadroRepository.findByUsuario(gestor)).thenReturn(List.of(new MembroQuadro(quadroComum, gestor)));
        when(membroQuadroRepository.existsByQuadroInAndUsuario(List.of(quadroComum), membro)).thenReturn(true);

        assertThat(service.podeVer(gestor, membro)).isTrue();
    }

    @Test
    void gestorNaoVeUsuarioForaDosQuadrosDosQuaisParticipa() {
        Usuario gestor = usuarioComId(2L, Papel.GESTOR);
        Usuario forasteiro = usuarioComId(4L, Papel.COLABORADOR);
        when(membroQuadroRepository.findByUsuario(gestor)).thenReturn(List.of());
        when(membroQuadroRepository.existsByQuadroInAndUsuario(List.of(), forasteiro)).thenReturn(false);

        assertThat(service.podeVer(gestor, forasteiro)).isFalse();
    }

    @Test
    void resolverAlvoSemFiltroRetornaOProprioSemTocarRepositorio() {
        Usuario usuario = usuarioComId(1L, Papel.COLABORADOR);

        Usuario resolvido = service.resolverAlvo(null, usuario, IllegalStateException::new);

        assertThat(resolvido).isSameAs(usuario);
        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void resolverAlvoComOProprioIdRetornaOProprioSemTocarRepositorio() {
        Usuario usuario = usuarioComId(1L, Papel.COLABORADOR);

        Usuario resolvido = service.resolverAlvo(1L, usuario, IllegalStateException::new);

        assertThat(resolvido).isSameAs(usuario);
        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void resolverAlvoAutorizadoRetornaOAlvo() {
        Usuario admin = usuarioComId(9L, Papel.ADMIN);
        Usuario alvo = usuarioComId(2L, Papel.COLABORADOR);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(alvo));

        Usuario resolvido = service.resolverAlvo(2L, admin, IllegalStateException::new);

        assertThat(resolvido).isSameAs(alvo);
    }

    @Test
    void resolverAlvoNaoAutorizadoLancaAExcecaoFornecida() {
        Usuario colaborador = usuarioComId(1L, Papel.COLABORADOR);
        Usuario outro = usuarioComId(2L, Papel.COLABORADOR);
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(outro));

        assertThatThrownBy(() -> service.resolverAlvo(2L, colaborador, IllegalStateException::new))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void resolverAlvoInexistenteLancaRecursoNaoEncontrado() {
        Usuario admin = usuarioComId(9L, Papel.ADMIN);
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolverAlvo(999L, admin, IllegalStateException::new))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
