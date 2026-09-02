package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AtualizarCargaDiariaRequest;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    private UsuarioService usuarioService;

    @BeforeEach
    void setUp() {
        usuarioService = new UsuarioService(usuarioRepository);
    }

    private static Usuario comId(Usuario usuario, Long id) {
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @Test
    void listaTodosOsUsuarios() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        Usuario beto = comId(new Usuario("Beto Lima", "beto@escritor.io", Papel.GESTOR, 360), 2L);
        when(usuarioRepository.findAll()).thenReturn(List.of(ana, beto));

        List<Long> ids = usuarioService.listar().stream().map(io.escritor.presenca.identidade.web.UsuarioResponse::id).toList();

        assertThat(ids).containsExactly(1L, 2L);
    }

    @Test
    void listaBasicoTrazSoIdENomeDosUsuariosAtivos() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        Usuario beto = comId(new Usuario("Beto Lima", "beto@escritor.io", Papel.GESTOR, 360), 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));

        var pessoas = usuarioService.listarBasico();

        assertThat(pessoas).hasSize(2);
        assertThat(pessoas.get(0).id()).isEqualTo(1L);
        assertThat(pessoas.get(0).nome()).isEqualTo("Ana Souza");
        assertThat(pessoas.get(1).nome()).isEqualTo("Beto Lima");
    }

    @Test
    void atualizaACargaDiariaDeUmUsuarioExistente() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(ana));
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = usuarioService.atualizarCargaDiaria(1L, new AtualizarCargaDiariaRequest(360));

        assertThat(resposta.cargaDiariaMinutos()).isEqualTo(360);
    }

    @Test
    void atualizarCargaDiariaDeUsuarioInexistenteLanca404() {
        when(usuarioRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> usuarioService.atualizarCargaDiaria(999L, new AtualizarCargaDiariaRequest(360)))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
