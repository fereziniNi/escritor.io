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
 *
 * <p>Auditoria de segurança (VULN-04, MEDIUM): {@code app.google.chave-criptografia} em {@code
 * application.yml} tem um default de 32 bytes zerados, versionado no repositório - se alguém
 * conectasse uma conta Google sem sobrescrever essa variável, o refresh token seria "criptografado"
 * com uma chave pública, trivialmente quebrável por quem tiver acesso ao banco. Diferente do
 * segredo do JWT (VULN-01, sempre em uso desde o primeiro login), o Google só entra em jogo se
 * {@code app.google.client-id}/{@code client-secret} também estiverem configurados - por isso a
 * recusa não é no boot da aplicação (quebraria toda instalação que nunca usa essa integração), é
 * no primeiro {@link #convertToDatabaseColumn}: é ali, no exato momento em que um segredo de
 * verdade seria gravado com uma chave pública, que faz sentido travar.
 */
@Converter
@Component
public class CriptografiaTokenConverter implements AttributeConverter<String, String> {

    private static final String ALGORITMO = "AES/GCM/NoPadding";
    private static final int TAMANHO_NONCE_BYTES = 12;
    private static final int TAMANHO_TAG_BITS = 128;

    /** O default literal de {@code application.yml} - 32 bytes zerados em base64. Único jeito
     * confiável de reconhecer "ninguém configurou isso de verdade": comparar o valor resolvido
     * contra esse literal específico (comparar só o tamanho não pega esse caso - 32 bytes é
     * exatamente o tamanho certo pra AES-256, só que com o mesmo valor sempre). */
    static final String CHAVE_PADRAO_INSEGURA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    private final SecretKeySpec chave;
    private final boolean chaveInsegura;
    private final SecureRandom aleatorio = new SecureRandom();

    public CriptografiaTokenConverter(@Value("${app.google.chave-criptografia}") String chaveBase64) {
        this.chave = new SecretKeySpec(Base64.getDecoder().decode(chaveBase64), "AES");
        this.chaveInsegura = CHAVE_PADRAO_INSEGURA.equals(chaveBase64);
    }

    @Override
    public String convertToDatabaseColumn(String valorEmClaro) {
        if (valorEmClaro == null) {
            return null;
        }
        if (chaveInsegura) {
            throw new IllegalStateException(
                    "app.google.chave-criptografia está com o valor placeholder de desenvolvimento (público, "
                            + "versionado no repositório) - não é seguro criptografar um token de verdade com ela. "
                            + "Defina a variável de ambiente APP_GOOGLE_CHAVE_CRIPTOGRAFIA com uma chave gerada "
                            + "(ex.: `openssl rand -base64 32`) antes de conectar uma conta Google - ver "
                            + "DEVELOPMENT.md.");
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
