package io.escritor.presenca.ponto.domain;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HashEncadeadoTest {

    private final Instant momento = Instant.parse("2026-01-15T12:00:00Z");

    @Test
    void mesmosParametrosProduzemMesmoHash() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);

        assertThat(h1).isEqualTo(h2);
    }

    @Test
    void hashAnteriorDiferenteProduzHashDiferente() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 =
                HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "outro-hash");

        assertThat(h1).isNotEqualTo(h2);
    }

    @Test
    void usuarioDiferenteProduzHashDiferente() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 = HashEncadeado.calcular(2L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);

        assertThat(h1).isNotEqualTo(h2);
    }

    @Test
    void tipoDiferenteProduzHashDiferente() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 = HashEncadeado.calcular(1L, TipoRegistroPonto.SAIDA, momento, OrigemRegistroPonto.WEB, null);

        assertThat(h1).isNotEqualTo(h2);
    }

    @Test
    void momentoDiferenteProduzHashDiferente() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 = HashEncadeado.calcular(
                1L, TipoRegistroPonto.ENTRADA, momento.plusSeconds(1), OrigemRegistroPonto.WEB, null);

        assertThat(h1).isNotEqualTo(h2);
    }

    @Test
    void origemDiferenteProduzHashDiferente() {
        String h1 = HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, null);
        String h2 =
                HashEncadeado.calcular(1L, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.ADMIN, null);

        assertThat(h1).isNotEqualTo(h2);
    }
}
