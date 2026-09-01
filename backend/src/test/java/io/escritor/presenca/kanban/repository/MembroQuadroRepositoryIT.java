package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.Quadro;
import java.util.List;
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
class MembroQuadroRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private QuadroRepository quadroRepository;

    @Autowired
    private MembroQuadroRepository membroQuadroRepository;

    @Test
    void persisteERecuperaMembroDeQuadro() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null));

        MembroQuadro salvo = membroQuadroRepository.saveAndFlush(new MembroQuadro(quadro, usuario));

        MembroQuadro recuperado = membroQuadroRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getQuadro().getId()).isEqualTo(quadro.getId());
        assertThat(recuperado.getUsuario().getId()).isEqualTo(usuario.getId());
    }

    @Test
    void rejeitaOMesmoUsuarioDuasVezesNoMesmoQuadro() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-dup@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadro, usuario));

        assertThatThrownBy(() -> membroQuadroRepository.saveAndFlush(new MembroQuadro(quadro, usuario)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void existsByQuadroAndUsuarioDetectaMembroJaExistente() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-exists@escritor.io", Papel.COLABORADOR, 480));
        Usuario outroUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-exists@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadro, usuario));

        assertThat(membroQuadroRepository.existsByQuadroAndUsuario(quadro, usuario)).isTrue();
        assertThat(membroQuadroRepository.existsByQuadroAndUsuario(quadro, outroUsuario)).isFalse();
    }

    @Test
    void findByUsuarioListaTodosOsQuadrosDoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-lista@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadroA = quadroRepository.saveAndFlush(new Quadro("Sistema A", null));
        Quadro quadroB = quadroRepository.saveAndFlush(new Quadro("Sistema B", null));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadroA, usuario));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadroB, usuario));

        List<MembroQuadro> membros = membroQuadroRepository.findByUsuario(usuario);

        assertThat(membros).hasSize(2);
    }

    @Test
    void existsByQuadroInAndUsuarioDetectaSobreposicaoDeQuadros() {
        Usuario requisitante = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-sobrepoe@escritor.io", Papel.GESTOR, 480));
        Usuario alvo = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-sobrepoe@escritor.io", Papel.COLABORADOR, 480));
        Usuario semQuadroEmComum = usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-sobrepoe@escritor.io", Papel.COLABORADOR, 480));
        Quadro quadroComum = quadroRepository.saveAndFlush(new Quadro("Sistema Comum", null));
        Quadro outroQuadro = quadroRepository.saveAndFlush(new Quadro("Outro Sistema", null));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadroComum, requisitante));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(quadroComum, alvo));
        membroQuadroRepository.saveAndFlush(new MembroQuadro(outroQuadro, semQuadroEmComum));

        assertThat(membroQuadroRepository.existsByQuadroInAndUsuario(List.of(quadroComum), alvo)).isTrue();
        assertThat(membroQuadroRepository.existsByQuadroInAndUsuario(List.of(quadroComum), semQuadroEmComum)).isFalse();
    }
}
