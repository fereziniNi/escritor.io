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
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit-test"));

        RegistroPonto recuperado = registroPontoRepository.findById(salvo.getId()).orElseThrow();

        assertThat(recuperado.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperado.getTipo()).isEqualTo(TipoRegistroPonto.ENTRADA);
        assertThat(recuperado.getMomento()).isEqualTo(momento);
        assertThat(recuperado.getOrigem()).isEqualTo(OrigemRegistroPonto.WEB);
        assertThat(recuperado.getIp()).isEqualTo("127.0.0.1");
        assertThat(recuperado.getUserAgent()).isEqualTo("junit-test");
        assertThat(recuperado.getCriadoEm()).isNotNull();
    }
}
