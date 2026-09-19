package io.escritor.presenca.googlecalendar.domain;

import java.security.SecureRandom;
import java.util.Base64;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CriptografiaTokenConverterTest {

    /** 32 bytes de verdade (não zerados) - auditoria de segurança (VULN-04) achou que a chave de
     * teste original (32 bytes zerados) era, coincidência ou não, exatamente igual ao placeholder
     * inseguro de {@code application.yml} ({@link CriptografiaTokenConverter#CHAVE_PADRAO_INSEGURA}),
     * o que faria a rejeição nova travar os próprios testes. Gerada com {@link SecureRandom} pra
     * nunca colidir de novo por acidente. */
    private static final String CHAVE_DE_TESTE = Base64.getEncoder().encodeToString(chaveAleatoria());

    private final CriptografiaTokenConverter converter = new CriptografiaTokenConverter(CHAVE_DE_TESTE);

    private static byte[] chaveAleatoria() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    @Test
    void oValorCriptografadoNuncaApareceEmTextoClaroNaColuna() {
        String valorArmazenado = converter.convertToDatabaseColumn("refresh-token-super-secreto");

        assertThat(valorArmazenado).doesNotContain("refresh-token-super-secreto");
    }

    @Test
    void descriptografarDevolveExatamenteOValorOriginal() {
        String armazenado = converter.convertToDatabaseColumn("1//refresh-de-verdade-da-google");

        assertThat(converter.convertToEntityAttribute(armazenado)).isEqualTo("1//refresh-de-verdade-da-google");
    }

    @Test
    void duasCriptografiasDoMesmoValorDaoResultadosDiferentes() {
        // nonce aleatório por chamada (ver javadoc da classe) - protege contra padrões repetidos
        // no banco caso o mesmo refresh token precise ser regravado.
        String primeira = converter.convertToDatabaseColumn("mesmo-valor");
        String segunda = converter.convertToDatabaseColumn("mesmo-valor");

        assertThat(primeira).isNotEqualTo(segunda);
        assertThat(converter.convertToEntityAttribute(primeira)).isEqualTo("mesmo-valor");
        assertThat(converter.convertToEntityAttribute(segunda)).isEqualTo("mesmo-valor");
    }

    @Test
    void nuloPassaDireto() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    // ---------- auditoria de segurança (VULN-04, MEDIUM) ----------

    @Test
    void recusaCriptografarComAChavePlaceholderInsegura() {
        var converterComChaveInsegura = new CriptografiaTokenConverter(CriptografiaTokenConverter.CHAVE_PADRAO_INSEGURA);

        assertThatThrownBy(() -> converterComChaveInsegura.convertToDatabaseColumn("refresh-token-de-verdade"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_GOOGLE_CHAVE_CRIPTOGRAFIA");
    }

    /** {@code null} nunca chega a tentar cifrar nada (early return antes da checagem de chave) -
     * não faz sentido recusar "criptografar nada". */
    @Test
    void nuloComChaveInseguraNaoLancaEDevolveNulo() {
        var converterComChaveInsegura = new CriptografiaTokenConverter(CriptografiaTokenConverter.CHAVE_PADRAO_INSEGURA);

        assertThat(converterComChaveInsegura.convertToDatabaseColumn(null)).isNull();
    }
}
