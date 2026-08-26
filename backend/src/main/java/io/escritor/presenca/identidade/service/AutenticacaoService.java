package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.GeradorCodigo;
import io.escritor.presenca.identidade.domain.GeradorTokenRenovacao;
import io.escritor.presenca.identidade.domain.TokenRenovacao;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.CodigoAcessoRepository;
import io.escritor.presenca.identidade.repository.TokenRenovacaoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.HashSha256;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.email.EnvioEmail;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AutenticacaoService {

    private final UsuarioRepository usuarioRepository;
    private final CodigoAcessoRepository codigoAcessoRepository;
    private final TokenRenovacaoRepository tokenRenovacaoRepository;
    private final PasswordEncoder passwordEncoder;
    private final EnvioEmail envioEmail;
    private final JwtService jwtService;
    private final Clock clock;

    public AutenticacaoService(
            UsuarioRepository usuarioRepository,
            CodigoAcessoRepository codigoAcessoRepository,
            TokenRenovacaoRepository tokenRenovacaoRepository,
            PasswordEncoder passwordEncoder,
            EnvioEmail envioEmail,
            JwtService jwtService,
            Clock clock) {
        this.usuarioRepository = usuarioRepository;
        this.codigoAcessoRepository = codigoAcessoRepository;
        this.tokenRenovacaoRepository = tokenRenovacaoRepository;
        this.passwordEncoder = passwordEncoder;
        this.envioEmail = envioEmail;
        this.jwtService = jwtService;
        this.clock = clock;
    }

    public void solicitarCodigo(String email) {
        usuarioRepository.findByEmailAndAtivoTrue(email).ifPresent(this::gerarEEnviarCodigo);
    }

    public TokensAutenticacao verificarCodigo(String email, String codigoPlano) {
        Usuario usuario = usuarioRepository.findByEmailAndAtivoTrue(email).orElseThrow(CodigoInvalidoException::new);

        CodigoAcesso codigo = codigoAcessoRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario)
                .orElseThrow(CodigoInvalidoException::new);

        Instant agora = Instant.now(clock);

        if (codigo.estaExpirado(agora) || codigo.excedeuTentativas()) {
            throw new CodigoInvalidoException();
        }

        if (!passwordEncoder.matches(codigoPlano, codigo.getCodigoHash())) {
            codigo.registrarTentativaFalha();
            codigoAcessoRepository.save(codigo);
            throw new CodigoInvalidoException();
        }

        codigo.marcarUsado(agora);
        codigoAcessoRepository.save(codigo);

        return emitirTokens(usuario);
    }

    public TokensAutenticacao renovarToken(String refreshTokenPlano) {
        TokenRenovacao token = tokenRenovacaoRepository
                .findByTokenHash(HashSha256.hash(refreshTokenPlano))
                .orElseThrow(TokenInvalidoException::new);

        Instant agora = Instant.now(clock);

        if (token.estaUsado()) {
            revogarTokensAtivos(token.getUsuario());
            throw new TokenInvalidoException();
        }

        if (token.estaExpirado(agora)) {
            throw new TokenInvalidoException();
        }

        token.marcarUsado(agora);
        tokenRenovacaoRepository.save(token);

        return emitirTokens(token.getUsuario());
    }

    private void revogarTokensAtivos(Usuario usuario) {
        Instant agora = Instant.now(clock);
        tokenRenovacaoRepository.findByUsuarioAndUsadoEmIsNull(usuario).forEach(ativo -> {
            ativo.marcarUsado(agora);
            tokenRenovacaoRepository.save(ativo);
        });
    }

    private TokensAutenticacao emitirTokens(Usuario usuario) {
        String accessToken = jwtService.gerarAccessToken(usuario.getId(), usuario.getPapel());

        String refreshTokenPlano = GeradorTokenRenovacao.gerar();
        TokenRenovacao tokenRenovacao = new TokenRenovacao(usuario, HashSha256.hash(refreshTokenPlano));
        tokenRenovacaoRepository.save(tokenRenovacao);

        return new TokensAutenticacao(accessToken, refreshTokenPlano);
    }

    private void gerarEEnviarCodigo(Usuario usuario) {
        invalidarCodigoAnterior(usuario);

        String codigo = GeradorCodigo.gerar();
        CodigoAcesso novo = new CodigoAcesso(usuario, passwordEncoder.encode(codigo));
        codigoAcessoRepository.save(novo);

        envioEmail.enviarCodigoAcesso(usuario.getEmail(), codigo);
    }

    private void invalidarCodigoAnterior(Usuario usuario) {
        codigoAcessoRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario)
                .ifPresent(anterior -> {
                    anterior.marcarUsado(Instant.now(clock));
                    codigoAcessoRepository.save(anterior);
                });
    }
}
