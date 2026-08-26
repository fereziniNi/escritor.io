package io.escritor.presenca.identidade.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;

import static org.assertj.core.api.Assertions.assertThat;

class GeradorCodigoTest {

    @RepeatedTest(50)
    void geraCodigoNumericoDeSeisDigitos() {
        String codigo = GeradorCodigo.gerar();

        assertThat(codigo).matches("\\d{6}");
    }

    @Test
    void geraCodigosDiferentesEntreChamadas() {
        String primeiro = GeradorCodigo.gerar();
        String segundo = GeradorCodigo.gerar();

        assertThat(primeiro).isNotEqualTo(segundo);
    }
}
