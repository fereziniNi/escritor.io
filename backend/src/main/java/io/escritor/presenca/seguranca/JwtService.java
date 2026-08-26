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

    private final SecretKey chave;

    public JwtService(@Value("${app.jwt.segredo}") String segredo) {
        this.chave = Keys.hmacShaKeyFor(segredo.getBytes(StandardCharsets.UTF_8));
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
