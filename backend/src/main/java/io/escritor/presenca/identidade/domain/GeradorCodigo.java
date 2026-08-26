package io.escritor.presenca.identidade.domain;

import java.security.SecureRandom;

public final class GeradorCodigo {

    private static final SecureRandom RANDOM = new SecureRandom();

    private GeradorCodigo() {
    }

    public static String gerar() {
        int valor = RANDOM.nextInt(1_000_000);
        return String.format("%06d", valor);
    }
}
