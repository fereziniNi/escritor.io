package io.escritor.presenca.ponto.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class RegistroPontoTest {

    private final Usuario usuario = usuarioComId(1L);
    private final Instant momento = Instant.parse("2026-01-15T12:00:00Z");

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @Test
    void primeiroRegistroDeUmUsuarioTemHashValidoSemAnterior() {
        RegistroPonto registro = new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);

        assertThat(registro.getHashAnterior()).isNull();
        assertThat(registro.hashValido()).isTrue();
    }

    @Test
    void segundoRegistroEncadeiaComOHashDoAnterior() {
        RegistroPonto entrada = new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);

        RegistroPonto saida = new RegistroPonto(
                usuario,
                TipoRegistroPonto.SAIDA,
                momento.plusSeconds(3600),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                entrada.getHash());

        assertThat(saida.getHashAnterior()).isEqualTo(entrada.getHash());
        assertThat(saida.hashValido()).isTrue();
    }

    @Test
    void alterarUmCampoDoRegistroInvalidaOHash() {
        RegistroPonto registro = new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
        assertThat(registro.hashValido()).isTrue();

        // simula uma alteração direta na linha do banco (bypassando a aplicação) - o hash
        // gravado continua o de antes, mas os campos mudaram.
        ReflectionTestUtils.setField(registro, "tipo", TipoRegistroPonto.SAIDA);

        assertThat(registro.hashValido()).isFalse();
    }
}
