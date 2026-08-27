package io.escritor.presenca.ponto.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class VerificadorCadeiaPontoTest {

    private final Usuario usuario = usuarioComId(1L);
    private final Instant momento = Instant.parse("2026-01-15T12:00:00Z");

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private RegistroPonto entrada() {
        return new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
    }

    private RegistroPonto saidaAposA(RegistroPonto anterior) {
        return new RegistroPonto(
                usuario,
                TipoRegistroPonto.SAIDA,
                momento.plusSeconds(3600),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                anterior.getHash());
    }

    @Test
    void cadeiaSemAlteracaoEValida() {
        RegistroPonto a = entrada();
        RegistroPonto b = saidaAposA(a);

        assertThat(VerificadorCadeiaPonto.cadeiaValida(List.of(a, b))).isTrue();
    }

    @Test
    void alterarUmCampoDoRegistroAnteriorQuebraAVerificacaoDaCadeia() {
        RegistroPonto a = entrada();
        RegistroPonto b = saidaAposA(a);

        ReflectionTestUtils.setField(a, "momento", momento.plusSeconds(999));

        assertThat(VerificadorCadeiaPonto.cadeiaValida(List.of(a, b))).isFalse();
    }

    @Test
    void hashAnteriorFabricadoDeFormaAutoconsistenteAindaAssimQuebraACadeia() {
        RegistroPonto a = entrada();
        // b é construído com um hashAnterior que não é o hash real de "a" - mas o hash do
        // próprio b é calculado em cima desse valor, então b sozinho passa em hashValido().
        // Só a verificação da cadeia (comparando com o hash real do registro anterior) pega isso.
        RegistroPonto b = new RegistroPonto(
                usuario,
                TipoRegistroPonto.SAIDA,
                momento.plusSeconds(3600),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                "hash-fabricado-mas-autoconsistente");

        assertThat(b.hashValido()).isTrue();
        assertThat(VerificadorCadeiaPonto.cadeiaValida(List.of(a, b))).isFalse();
    }

    @Test
    void cadeiaVaziaEValida() {
        assertThat(VerificadorCadeiaPonto.cadeiaValida(List.of())).isTrue();
    }
}
