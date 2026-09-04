package io.escritor.presenca.identidade.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.AparenciaInvalidaException;
import io.escritor.presenca.identidade.domain.EstiloBottom;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloJaqueta;
import io.escritor.presenca.identidade.domain.EstiloOutro;
import io.escritor.presenca.identidade.domain.EstiloSapato;
import io.escritor.presenca.identidade.domain.EstiloTop;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.TipoRosto;
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

    private static AtualizarAparenciaRequest requisicaoAparenciaValida(TipoBarba tipoBarba) {
        return new AtualizarAparenciaRequest(
                "#f2c9a0", TipoRosto.OVAL, EstiloCabelo.LONGO, "#4a3728", tipoBarba,
                EstiloTop.POLO, "#4472c4", EstiloJaqueta.BOMBER, "#1c1a28",
                EstiloBottom.JEANS, "#2b2b3a", EstiloSapato.BOTA, "#1c1a28",
                TipoChapeu.BONE, "#c0392b", TipoOculos.REDONDO, "#1c1a28", EstiloOutro.COLAR, "#c9a24a");
    }

    @Test
    void atualizaAPropriaAparenciaENotificaQuemJaEstaConectado() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        when(usuarioRepository.save(any(Usuario.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = usuarioService.atualizarMinhaAparencia(ana, requisicaoAparenciaValida(TipoBarba.CAVANHAQUE));

        assertThat(resposta.aparencia().estiloTop()).isEqualTo(EstiloTop.POLO);
        assertThat(resposta.aparencia().estiloJaqueta()).isEqualTo(EstiloJaqueta.BOMBER);
        assertThat(resposta.aparencia().tipoBarba()).isEqualTo(TipoBarba.CAVANHAQUE);
        verify(presencaWebSocketHandler).atualizarAparencia(eq(1L), any(AparenciaAvatar.class));
    }

    @Test
    void atualizarAparenciaComCorForaDaPaletaLancaAparenciaInvalida() {
        Usuario ana = comId(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480), 1L);
        var requisicaoComCorInvalida = new AtualizarAparenciaRequest(
                "#123456", TipoRosto.PADRAO, EstiloCabelo.CURTO, "#4a3728", TipoBarba.NENHUM,
                EstiloTop.CAMISETA, "#6b7280", EstiloJaqueta.NENHUMA, "#6b7280",
                EstiloBottom.CALCA, "#2b2b3a", EstiloSapato.TENIS, "#1c1a28",
                TipoChapeu.NENHUM, "#6b7280", TipoOculos.NENHUM, "#6b7280", EstiloOutro.NENHUM, "#6b7280");

        assertThatThrownBy(() -> usuarioService.atualizarMinhaAparencia(ana, requisicaoComCorInvalida))
                .isInstanceOf(AparenciaInvalidaException.class);
    }
}
