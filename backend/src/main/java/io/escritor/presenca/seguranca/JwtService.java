package io.escritor.presenca.seguranca;

import io.escritor.presenca.identidade.domain.Papel;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {

    private static final Duration VALIDADE_ACCESS_TOKEN = Duration.ofMinutes(15);

    /**
     * Achado de auditoria de segurança (VULN-01, CRITICAL): o valor de {@code app.jwt.segredo} em
     * {@code application.yml} é um placeholder de desenvolvimento versionado no repositório - até
     * esta correção, nada impedia a aplicação de subir (em qualquer ambiente, inclusive um deploy
     * real) usando exatamente esse valor conhecido publicamente. Confirmado ao vivo: dava pra
     * forjar um JWT de ADMIN sem nunca ter feito login, só lendo este arquivo.
     *
     * <p>{@link #validarSegredo} agora recusa a aplicação subir (falha no boot do Spring, não
     * silenciosamente em runtime) se o segredo resolvido for este placeholder específico OU for
     * curto demais - a segunda checagem é defesa em profundidade contra QUALQUER valor fraco
     * futuro, não só este. A variável de ambiente {@code APP_JWT_SEGREDO} (maior precedência que
     * este arquivo, ver {@code docker-compose.yml}) é quem deve fornecer o valor de verdade - ver
     * DEVELOPMENT.md.
     */
    static final String SEGREDO_PLACEHOLDER_INSEGURO = "troque-este-segredo-em-producao-defina-a-variavel-app-jwt-segredo";

    /** 256 bits - mínimo recomendado pra HMAC-SHA (RFC 7518 §3.2) independente de qual variante
     * (HS256/384/512) o jjwt escolher com base no tamanho da chave. O placeholder acima tem 66
     * bytes - passaria por esta checagem sozinha, por isso as duas checagens são necessárias. */
    private static final int TAMANHO_MINIMO_BYTES = 32;

    private final SecretKey chave;

    public JwtService(@Value("${app.jwt.segredo}") String segredo) {
        validarSegredo(segredo);
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
    }

    private static void validarSegredo(String segredo) {
        if (segredo == null || segredo.isBlank()) {
            throw new IllegalStateException(
                    "app.jwt.segredo não configurado. Defina a variável de ambiente APP_JWT_SEGREDO "
                            + "com um valor gerado (ex.: `openssl rand -base64 64`) - ver DEVELOPMENT.md.");
        }
        if (segredo.equals(SEGREDO_PLACEHOLDER_INSEGURO)) {
            throw new IllegalStateException(
                    "app.jwt.segredo está com o valor placeholder de desenvolvimento, que é público "
                            + "(está versionado no repositório) - qualquer um consegue forjar um token de ADMIN com "
                            + "ele. Defina a variável de ambiente APP_JWT_SEGREDO com um valor gerado (ex.: "
                            + "`openssl rand -base64 64`) - ver DEVELOPMENT.md.");
        }
        if (segredo.getBytes(StandardCharsets.UTF_8).length < TAMANHO_MINIMO_BYTES) {
            throw new IllegalStateException(
                    "app.jwt.segredo tem menos de " + TAMANHO_MINIMO_BYTES + " bytes - fraco demais pra "
                            + "HMAC-SHA. Defina a variável de ambiente APP_JWT_SEGREDO com um valor gerado (ex.: "
                            + "`openssl rand -base64 64`) - ver DEVELOPMENT.md.");
        }
    }

    public String gerarAccessToken(Long usuarioId, Papel papel) {
        Instant agora = Instant.now();

        return Jwts.builder()
                .subject(usuarioId.toString())
                .claim("papel", papel.name())
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(VALIDADE_ACCESS_TOKEN)))
                .signWith(chave)
                .compact();
    }

    public Optional<Jws<Claims>> validar(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(chave).build().parseSignedClaims(token));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
