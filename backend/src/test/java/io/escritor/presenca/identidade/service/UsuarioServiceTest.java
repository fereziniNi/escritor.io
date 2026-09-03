package io.escritor.presenca.identidade.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.AparenciaInvalidaException;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloRoupa;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AtualizarAparenciaRequest;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PresencaWebSocketHandler presencaWebSocketHandler;

    private UsuarioService usuarioService;

    @BeforeEach
    void setUp() {
        usuarioService = new UsuarioService(usuarioRepository, presencaWebSocketHandler);
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

    @Test
    void buscaOProprioUsuarioAutenticado() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);

        var resposta = usuarioService.buscarMeuUsuario(ana);

        assertThat(resposta.id()).isEqualTo(1L);
        assertThat(resposta.nome()).isEqualTo("Ana Souza");
    }

    private static AtualizarAparenciaRequest requestAparenciaValida() {
        return new AtualizarAparenciaRequest("#f2c9a0", EstiloCabelo.LONGO, "#c9a24a", EstiloRoupa.MOLETOM, "#e0546f", TipoOculos.REDONDO, TipoChapeu.BONE);
    }

    @Test
    void atualizaAPropriaAparenciaENotificaQuemJaEstaConectado() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = usuarioService.atualizarMinhaAparencia(ana, requestAparenciaValida());

        assertThat(resposta.aparencia().estiloCabelo()).isEqualTo(EstiloCabelo.LONGO);
        assertThat(resposta.aparencia().estiloRoupa()).isEqualTo(EstiloRoupa.MOLETOM);
        assertThat(resposta.aparencia().corRoupa()).isEqualTo("#e0546f");
        assertThat(resposta.aparencia().oculos()).isEqualTo(TipoOculos.REDONDO);
        assertThat(resposta.aparencia().chapeu()).isEqualTo(TipoChapeu.BONE);
        verify(presencaWebSocketHandler).atualizarAparencia(eq(1L), any());
    }

    @Test
    void atualizarAparenciaComCorForaDaPaletaLancaExcecaoSemSalvar() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        var requestInvalido =
                new AtualizarAparenciaRequest("#000000", EstiloCabelo.LONGO, "#c9a24a", EstiloRoupa.MOLETOM, "#e0546f", TipoOculos.REDONDO, TipoChapeu.BONE);

        assertThatThrownBy(() -> usuarioService.atualizarMinhaAparencia(ana, requestInvalido))
                .isInstanceOf(AparenciaInvalidaException.class);

        verify(usuarioRepository, never()).save(any());
        verify(presencaWebSocketHandler, never()).atualizarAparencia(any(), any());
    }
}
