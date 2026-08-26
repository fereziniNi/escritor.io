package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UsuarioRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void persisteERecuperaUsuarioComTodosOsCampos() {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);

        Usuario salvo = usuarioRepository.saveAndFlush(usuario);
        usuarioRepository.findById(salvo.getId()).orElseThrow();

        Usuario recuperado = usuarioRepository.findById(salvo.getId()).orElseThrow();

        assertThat(recuperado.getNome()).isEqualTo("Ana Souza");
        assertThat(recuperado.getEmail()).isEqualTo("ana@escritor.io");
        assertThat(recuperado.getPapel()).isEqualTo(Papel.COLABORADOR);
        assertThat(recuperado.getCargaDiariaMinutos()).isEqualTo(360);
        assertThat(recuperado.isAtivo()).isTrue();
        assertThat(recuperado.getCriadoEm()).isNotNull();
    }

    @Test
    void rejeitaEmailDuplicado() {
        usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "duplicado@escritor.io", Papel.COLABORADOR, 360));

        Usuario duplicado = new Usuario("Outra Ana", "duplicado@escritor.io", Papel.GESTOR, 480);

        assertThatThrownBy(() -> usuarioRepository.saveAndFlush(duplicado))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
