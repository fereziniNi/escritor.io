package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.CodigoAcessoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.email.EnvioEmail;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutenticacaoServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private CodigoAcessoRepository codigoAcessoRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EnvioEmail envioEmail;

    private AutenticacaoService autenticacaoService;

    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        autenticacaoService =
                new AutenticacaoService(usuarioRepository, codigoAcessoRepository, passwordEncoder, envioEmail);
    }

    @Test
    void enviaCodigoQuandoEmailPertenceAUsuarioAtivo() {
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash-do-codigo");

        autenticacaoService.solicitarCodigo("ana@escritor.io");

        verify(envioEmail).enviarCodigoAcesso(eq("ana@escritor.io"), anyString());
        verify(codigoAcessoRepository).save(any(CodigoAcesso.class));
    }

    @Test
    void naoFazNadaObservavelQuandoEmailNaoEstaCadastrado() {
        when(usuarioRepository.findByEmailAndAtivoTrue("fantasma@escritor.io")).thenReturn(Optional.empty());

        assertThatCode(() -> autenticacaoService.solicitarCodigo("fantasma@escritor.io"))
                .doesNotThrowAnyException();

        verifyNoInteractions(envioEmail);
        verifyNoInteractions(codigoAcessoRepository);
    }

    @Test
    void invalidaCodigoAnteriorNaoUsadoAoGerarNovo() {
        CodigoAcesso anterior = new CodigoAcesso(usuario, "hash-antigo");
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(anterior));
        when(passwordEncoder.encode(anyString())).thenReturn("hash-novo");

        autenticacaoService.solicitarCodigo("ana@escritor.io");

        assertThat(anterior.estaUsado()).isTrue();
        verify(codigoAcessoRepository).save(anterior);
    }
}
