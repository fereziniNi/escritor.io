package io.escritor.presenca.googlecalendar.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES/GCM pro refresh token da Google em repouso (ver javadoc de {@link ContaGoogleCalendar}) -
 * diferente de {@code HashSha256} (usada em {@code TokenRenovacao}), aqui o valor precisa ser
 * recuperável em texto claro, não só comparável (a Google exige o refresh token de volta pra
 * renovar o access token). Formato armazenado: base64(nonce de 12 bytes + ciphertext+tag do GCM),
 * tudo numa string só, pra caber numa coluna de texto normal.
 *
 * <p>{@code @Component} de propósito: o Spring Boot registra converters JPA anotados como bean
 * gerenciado automaticamente (via {@code SpringBeanContainer}), permitindo injetar a chave por
 * {@code @Value} em vez de um construtor sem argumentos.
 */
@Converter
@Component
public class CriptografiaTokenConverter implements AttributeConverter<String, String> {

    private static final String ALGORITMO = "AES/GCM/NoPadding";
    private static final int TAMANHO_NONCE_BYTES = 12;
    private static final int TAMANHO_TAG_BITS = 128;

    private final SecretKeySpec chave;
    private final SecureRandom aleatorio = new SecureRandom();

    public CriptografiaTokenConverter(@Value("${app.google.chave-criptografia}") String chaveBase64) {
        this.chave = new SecretKeySpec(Base64.getDecoder().decode(chaveBase64), "AES");
    }

    @Override
    public String convertToDatabaseColumn(String valorEmClaro) {
        if (valorEmClaro == null) {
            return null;
        }
        try {
            byte[] nonce = new byte[TAMANHO_NONCE_BYTES];
            aleatorio.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(ALGORITMO);
            cipher.init(Cipher.ENCRYPT_MODE, chave, new GCMParameterSpec(TAMANHO_TAG_BITS, nonce));
            byte[] cifrado = cipher.doFinal(valorEmClaro.getBytes(StandardCharsets.UTF_8));
            byte[] combinado = new byte[nonce.length + cifrado.length];
            System.arraycopy(nonce, 0, combinado, 0, nonce.length);
            System.arraycopy(cifrado, 0, combinado, nonce.length, cifrado.length);
            return Base64.getEncoder().encodeToString(combinado);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao criptografar token", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String valorArmazenado) {
        if (valorArmazenado == null) {
            return null;
        }
        try {
            byte[] combinado = Base64.getDecoder().decode(valorArmazenado);
            byte[] nonce = new byte[TAMANHO_NONCE_BYTES];
            System.arraycopy(combinado, 0, nonce, 0, TAMANHO_NONCE_BYTES);
            Cipher cipher = Cipher.getInstance(ALGORITMO);
            cipher.init(Cipher.DECRYPT_MODE, chave, new GCMParameterSpec(TAMANHO_TAG_BITS, nonce));
            byte[] decifrado = cipher.doFinal(combinado, TAMANHO_NONCE_BYTES, combinado.length - TAMANHO_NONCE_BYTES);
            return new String(decifrado, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao descriptografar token", e);
        }
    }
}
