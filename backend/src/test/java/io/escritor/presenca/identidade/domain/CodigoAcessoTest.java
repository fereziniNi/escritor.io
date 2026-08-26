package io.escritor.presenca.identidade.domain;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CodigoAcessoTest {

    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);

    @Test
    void expiraDezMinutosAposCriacao() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        Duration validade = Duration.between(codigo.getCriadoEm(), codigo.getExpiraEm());

        assertThat(validade).isEqualTo(Duration.ofMinutes(10));
    }

    @Test
    void naoEstaExpiradoAntesDoPrazo() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        assertThat(codigo.estaExpirado(codigo.getCriadoEm().plus(Duration.ofMinutes(9)))).isFalse();
    }

    @Test
    void estaExpiradoAposOPrazo() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        assertThat(codigo.estaExpirado(codigo.getCriadoEm().plus(Duration.ofMinutes(11)))).isTrue();
    }

    @Test
    void naoEstaUsadoRecemCriado() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        assertThat(codigo.estaUsado()).isFalse();
    }

    @Test
    void marcarUsadoTornaEstaUsadoVerdadeiro() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        codigo.marcarUsado(Instant.now());

        assertThat(codigo.estaUsado()).isTrue();
    }

    @Test
    void excedeuTentativasSomenteAposCincoFalhas() {
        CodigoAcesso codigo = new CodigoAcesso(usuario, "hash-fake");

        for (int i = 0; i < 4; i++) {
            codigo.registrarTentativaFalha();
            assertThat(codigo.excedeuTentativas()).isFalse();
        }

        codigo.registrarTentativaFalha();

        assertThat(codigo.excedeuTentativas()).isTrue();
    }
}
