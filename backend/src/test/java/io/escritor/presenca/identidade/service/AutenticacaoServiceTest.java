package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TokenRenovacao;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.CodigoAcessoRepository;
import io.escritor.presenca.identidade.repository.TokenRenovacaoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.HashSha256;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.email.EnvioEmail;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
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
    private TokenRenovacaoRepository tokenRenovacaoRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EnvioEmail envioEmail;

    @Mock
    private JwtService jwtService;

    private AutenticacaoService autenticacaoService;

    private final Usuario usuario = usuarioComId(1L);

    @BeforeEach
    void setUp() {
        autenticacaoService = servico(Clock.systemUTC());
    }

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private AutenticacaoService servico(Clock clock) {
        return new AutenticacaoService(
                usuarioRepository,
                codigoAcessoRepository,
                tokenRenovacaoRepository,
                passwordEncoder,
                envioEmail,
                jwtService,
                clock);
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

    @Test
    void codigoCorretoGeraTokensEMarcaCodigoUsado() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-certo");
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(codigo));
        when(passwordEncoder.matches("123456", "hash-certo")).thenReturn(true);
        when(jwtService.gerarAccessToken(anyLong(), eq(Papel.COLABORADOR))).thenReturn("access-token-fake");

        TokensAutenticacao tokens = autenticacaoService.verificarCodigo("ana@escritor.io", "123456");

        assertThat(tokens.accessToken()).isEqualTo("access-token-fake");
        assertThat(tokens.refreshToken()).isNotBlank();
        assertThat(codigo.estaUsado()).isTrue();
        verify(tokenRenovacaoRepository).save(any(TokenRenovacao.class));
    }

    @Test
    void codigoErradoLancaExcecaoERegistraTentativa() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-certo");
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(codigo));
        when(passwordEncoder.matches("000000", "hash-certo")).thenReturn(false);

        assertThatThrownBy(() -> autenticacaoService.verificarCodigo("ana@escritor.io", "000000"))
                .isInstanceOf(CodigoInvalidoException.class);

        assertThat(codigo.getTentativas()).isEqualTo(1);
        verify(codigoAcessoRepository).save(codigo);
        verifyNoInteractions(jwtService);
    }

    @Test
    void semCodigoPendenteLancaExcecao() {
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticacaoService.verificarCodigo("ana@escritor.io", "123456"))
                .isInstanceOf(CodigoInvalidoException.class);
    }

    @Test
    void usuarioNaoEncontradoLancaExcecao() {
        when(usuarioRepository.findByEmailAndAtivoTrue("fantasma@escritor.io")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticacaoService.verificarCodigo("fantasma@escritor.io", "123456"))
                .isInstanceOf(CodigoInvalidoException.class);
    }

    @Test
    void codigoExpiradoLancaExcecaoSemChecarOValor() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-certo");
        Clock relogioOnzeMinutosDepois =
                Clock.fixed(codigo.getCriadoEm().plus(Duration.ofMinutes(11)), ZoneOffset.UTC);
        AutenticacaoService servicoComRelogioFuturo = servico(relogioOnzeMinutosDepois);

        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(codigo));

        assertThatThrownBy(() -> servicoComRelogioFuturo.verificarCodigo("ana@escritor.io", "123456"))
                .isInstanceOf(CodigoInvalidoException.class);

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void tentativasExcedidasRejeitaMesmoComCodigoCorreto() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-certo");
        for (int i = 0; i < 5; i++) {
            codigo.registrarTentativaFalha();
        }
        when(usuarioRepository.findByEmailAndAtivoTrue("ana@escritor.io")).thenReturn(Optional.of(usuario));
        when(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(codigo));

        assertThatThrownBy(() -> autenticacaoService.verificarCodigo("ana@escritor.io", "123456"))
                .isInstanceOf(CodigoInvalidoException.class);

        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void tokenValidoRotacionaEGeraNovosTokens() {
        TokenRenovacao tokenAntigo = new TokenRenovacao(usuario, HashSha256.hash("token-plano-antigo"));
        when(tokenRenovacaoRepository.findByTokenHash(HashSha256.hash("token-plano-antigo")))
                .thenReturn(Optional.of(tokenAntigo));
        when(jwtService.gerarAccessToken(anyLong(), eq(Papel.COLABORADOR))).thenReturn("novo-access-token");

        TokensAutenticacao tokens = autenticacaoService.renovarToken("token-plano-antigo");

        assertThat(tokens.accessToken()).isEqualTo("novo-access-token");
        assertThat(tokens.refreshToken()).isNotBlank().isNotEqualTo("token-plano-antigo");
        assertThat(tokenAntigo.estaUsado()).isTrue();
        verify(tokenRenovacaoRepository).save(tokenAntigo);
        verify(tokenRenovacaoRepository).save(argThat(t -> t != tokenAntigo));
    }

    @Test
    void tokenInexistenteLancaExcecao() {
        when(tokenRenovacaoRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticacaoService.renovarToken("token-desconhecido"))
                .isInstanceOf(TokenInvalidoException.class);
    }

    @Test
    void tokenExpiradoLancaExcecao() {
        TokenRenovacao token = new TokenRenovacao(usuario, HashSha256.hash("token-plano"));
        Clock relogioTrintaEUmDiasDepois =
                Clock.fixed(token.getCriadoEm().plus(Duration.ofDays(31)), ZoneOffset.UTC);
        AutenticacaoService servicoComRelogioFuturo = servico(relogioTrintaEUmDiasDepois);

        when(tokenRenovacaoRepository.findByTokenHash(HashSha256.hash("token-plano")))
                .thenReturn(Optional.of(token));

        assertThatThrownBy(() -> servicoComRelogioFuturo.renovarToken("token-plano"))
                .isInstanceOf(TokenInvalidoException.class);
    }

    @Test
    void tokenJaUsadoLancaExcecaoERevogaOutrosTokensAtivosDoUsuario() {
        TokenRenovacao tokenReaproveitado = new TokenRenovacao(usuario, HashSha256.hash("token-roubado"));
        tokenReaproveitado.marcarUsado(tokenReaproveitado.getCriadoEm());

        TokenRenovacao outroTokenAtivo = new TokenRenovacao(usuario, "outro-hash-ativo");

        when(tokenRenovacaoRepository.findByTokenHash(HashSha256.hash("token-roubado")))
                .thenReturn(Optional.of(tokenReaproveitado));
        when(tokenRenovacaoRepository.findByUsuarioAndUsadoEmIsNull(usuario))
                .thenReturn(List.of(outroTokenAtivo));

        assertThatThrownBy(() -> autenticacaoService.renovarToken("token-roubado"))
                .isInstanceOf(TokenInvalidoException.class);

        assertThat(outroTokenAtivo.estaUsado()).isTrue();
        verify(tokenRenovacaoRepository).save(outroTokenAtivo);
        verifyNoInteractions(jwtService);
    }
}
