package io.escritor.presenca.googlecalendar.domain;

import java.util.Base64;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CriptografiaTokenConverterTest {

    private static final String CHAVE_DE_TESTE = Base64.getEncoder().encodeToString(new byte[32]);

    private final CriptografiaTokenConverter converter = new CriptografiaTokenConverter(CHAVE_DE_TESTE);

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
}
