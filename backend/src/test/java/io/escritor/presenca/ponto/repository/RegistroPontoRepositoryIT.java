package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RegistroPontoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RegistroPontoRepository registroPontoRepository;

    @Test
    void persisteERecuperaRegistroPonto() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));
        Instant momento = Instant.parse("2026-01-15T12:00:00Z");

        RegistroPonto salvo = registroPontoRepository.saveAndFlush(new RegistroPonto(
                usuario,
                TipoRegistroPonto.ENTRADA,
                momento,
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit-test",
                null));

        RegistroPonto recuperado = registroPontoRepository.findById(salvo.getId()).orElseThrow();

        assertThat(recuperado.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperado.getTipo()).isEqualTo(TipoRegistroPonto.ENTRADA);
        assertThat(recuperado.getMomento()).isEqualTo(momento);
        assertThat(recuperado.getOrigem()).isEqualTo(OrigemRegistroPonto.WEB);
        assertThat(recuperado.getIp()).isEqualTo("127.0.0.1");
        assertThat(recuperado.getUserAgent()).isEqualTo("junit-test");
        assertThat(recuperado.getHashAnterior()).isNull();
        assertThat(recuperado.getHash()).isNotBlank();
        assertThat(recuperado.hashValido()).isTrue();
        assertThat(recuperado.getCriadoEm()).isNotNull();
    }

    @Test
    void encontraRegistrosDoUsuarioDentroDoPeriodoEIgnoraForaEOutroUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-periodo@escritor.io", Papel.COLABORADOR, 480));
        Usuario outroUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-periodo@escritor.io", Papel.COLABORADOR, 480));
        Instant inicioDoPeriodo = Instant.parse("2026-01-10T00:00:00Z");
        Instant fimDoPeriodo = Instant.parse("2026-01-14T00:00:00Z");

        RegistroPonto dentro = registroPontoRepository.saveAndFlush(
                new RegistroPonto(usuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-11T09:00:00Z"), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));
        // fora do período (antes).
        registroPontoRepository.saveAndFlush(
                new RegistroPonto(usuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-09T09:00:00Z"), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));
        // fora do período (depois, no limite exclusivo).
        registroPontoRepository.saveAndFlush(
                new RegistroPonto(usuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-14T00:00:00Z"), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));
        // dentro do período, mas de outro usuário.
        registroPontoRepository.saveAndFlush(
                new RegistroPonto(outroUsuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-11T09:00:00Z"), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));

        var encontrados = registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                usuario, inicioDoPeriodo, fimDoPeriodo);

        assertThat(encontrados).extracting(RegistroPonto::getId).containsExactly(dentro.getId());
    }
}
