package io.escritor.presenca.seguranca;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HashSha256Test {

    @Test
    void mesmaEntradaProduzMesmoHash() {
        assertThat(HashSha256.hash("abc123")).isEqualTo(HashSha256.hash("abc123"));
    }

    @Test
    void entradasDiferentesProduzemHashesDiferentes() {
        assertThat(HashSha256.hash("abc123")).isNotEqualTo(HashSha256.hash("abc124"));
    }

    @Test
    void hashNuncaEIgualAoValorOriginal() {
        assertThat(HashSha256.hash("abc123")).isNotEqualTo("abc123");
    }

    @Test
    void produzHexadecimalDeSessentaEQuatroCaracteres() {
        assertThat(HashSha256.hash("qualquer-coisa")).matches("[0-9a-f]{64}");
    }
}
