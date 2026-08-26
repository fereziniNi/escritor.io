package io.escritor.presenca.seguranca;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Hash rápido e determinístico, para segredos de alta entropia (ex.: refresh token opaco de 256
 * bits) onde é preciso localizar o registro por igualdade no banco. Não usar para segredos de
 * baixa entropia como senhas ou códigos de 6 dígitos — para esses, o custo computacional do BCrypt
 * é a proteção real (ver {@link io.escritor.presenca.identidade.domain.CodigoAcesso}).
 */
public final class HashSha256 {

    private HashSha256() {
    }

    public static String hash(String valor) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(valor.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
