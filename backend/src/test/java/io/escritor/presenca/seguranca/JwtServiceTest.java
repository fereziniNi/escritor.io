package io.escritor.presenca.seguranca;

import io.escritor.presenca.identidade.domain.Papel;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SEGREDO_TESTE = "segredo-de-teste-com-tamanho-suficiente-para-hmac-sha256";

    private final JwtService jwtService = new JwtService(SEGREDO_TESTE);

    @Test
    void tokenGeradoTemSubjectEPapelCorretos() {
        String token = jwtService.gerarAccessToken(42L, Papel.GESTOR);

        var claims = jwtService.validar(token).orElseThrow();

        assertThat(claims.getPayload().getSubject()).isEqualTo("42");
        assertThat(claims.getPayload().get("papel", String.class)).isEqualTo("GESTOR");
    }

    @Test
    void rejeitaTokenAdulterado() {
        String token = jwtService.gerarAccessToken(42L, Papel.GESTOR);

        assertThat(jwtService.validar(adulterar(token))).isEmpty();
    }

    /**
     * Troca um caractere no meio do token, não o último. O último caractere de um JWT
     * compacto cai numa fronteira de padding do base64url onde alguns valores decodificam
     * para o mesmo byte — trocar ali pode gerar um token "adulterado" que ainda é válido.
     */
    private static String adulterar(String token) {
        int posicao = token.length() / 2;
        char trocado = token.charAt(posicao) == 'a' ? 'b' : 'a';
        return token.substring(0, posicao) + trocado + token.substring(posicao + 1);
    }

    @Test
    void rejeitaTokenExpirado() {
        SecretKey chave = Keys.hmacShaKeyFor(SEGREDO_TESTE.getBytes());
        Instant passado = Instant.now().minus(1, ChronoUnit.HOURS);
        String tokenExpirado = Jwts.builder()
                .subject("42")
                .claim("papel", "GESTOR")
                .issuedAt(Date.from(passado.minusSeconds(60)))
                .expiration(Date.from(passado))
                .signWith(chave)
                .compact();

        assertThat(jwtService.validar(tokenExpirado)).isEmpty();
    }

    @Test
    void rejeitaLixoQueNaoEUmToken() {
        assertThat(jwtService.validar("isto-nao-e-um-jwt")).isEmpty();
    }
}
