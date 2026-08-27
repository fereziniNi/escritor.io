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
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AutenticacaoService {

    private static final Logger log = LoggerFactory.getLogger(AutenticacaoService.class);
    private static final Duration COOLDOWN_REENVIO_CODIGO = Duration.ofSeconds(30);

    private final UsuarioRepository usuarioRepository;
    private final CodigoAcessoRepository codigoAcessoRepository;
    private final TokenRenovacaoRepository tokenRenovacaoRepository;
    private final PasswordEncoder passwordEncoder;
    private final EnvioEmail envioEmail;
    private final JwtService jwtService;
    private final Clock clock;

    /**
     * Hash fantasma contra timing attack: quando o e-mail não existe, comparamos o código
     * informado contra este hash mesmo assim, para que o tempo de resposta não denuncie quais
     * e-mails estão cadastrados (ver ADR 0008).
     */
    private final String hashFantasma;

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
        this.hashFantasma = passwordEncoder.encode("000000");
    }

    public void solicitarCodigo(String email) {
        usuarioRepository.findByEmailAndAtivoTrue(email).ifPresent(this::gerarEEnviarCodigo);
    }

    public TokensAutenticacao verificarCodigo(String email, String codigoPlano) {
        Optional<Usuario> usuario = usuarioRepository.findByEmailAndAtivoTrue(email);

        if (usuario.isEmpty()) {
            // Comparação fantasma: gasta o mesmo tempo de um BCrypt.matches de verdade,
            // para não vazar por tempo de resposta se o e-mail existe ou não.
            passwordEncoder.matches(codigoPlano, hashFantasma);
            throw new CodigoInvalidoException();
        }

        CodigoAcesso codigo = codigoAcessoRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario.get())
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

        return emitirTokens(usuario.get());
    }

    public TokensAutenticacao renovarToken(String refreshTokenPlano) {
        TokenRenovacao token = tokenRenovacaoRepository
                .findByTokenHash(HashSha256.hash(refreshTokenPlano))
                .orElseThrow(TokenInvalidoException::new);

        if (!token.getUsuario().isAtivo()) {
            throw new TokenInvalidoException();
        }

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
        Instant agora = Instant.now(clock);
        Optional<CodigoAcesso> codigoAtual =
                codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario);

        if (codigoAtual.isPresent() && aindaEmCooldown(codigoAtual.get(), agora)) {
            return;
        }

        codigoAtual.ifPresent(anterior -> {
            anterior.marcarUsado(agora);
            codigoAcessoRepository.save(anterior);
        });

        String codigo = GeradorCodigo.gerar();
        CodigoAcesso novo = new CodigoAcesso(usuario, passwordEncoder.encode(codigo));
        codigoAcessoRepository.save(novo);

        try {
            envioEmail.enviarCodigoAcesso(usuario.getEmail(), codigo);
        } catch (RuntimeException e) {
            // Não deixa a solicitação de código falhar por causa do envio: a resposta ao
            // cliente precisa continuar idêntica exista ou não o e-mail (ADR 0008), e o código
            // já foi persistido - o usuário pode pedir um novo depois do cooldown se este e-mail
            // não chegou.
            log.warn("Falha ao enviar e-mail de código de acesso para {}", usuario.getEmail(), e);
        }
    }

    private boolean aindaEmCooldown(CodigoAcesso codigo, Instant agora) {
        return Duration.between(codigo.getCriadoEm(), agora).compareTo(COOLDOWN_REENVIO_CODIGO) < 0;
    }
}
