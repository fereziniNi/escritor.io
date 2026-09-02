package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.LocalDate;
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
class MembroProjetoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private MembroProjetoRepository membroProjetoRepository;

    private static Projeto novoProjeto(String nome) {
        return new Projeto(nome, "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    }

    @Test
    void persisteERecuperaMembroDeProjeto() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));

        MembroProjeto salvo = membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, usuario));

        MembroProjeto recuperado = membroProjetoRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getProjeto().getId()).isEqualTo(projeto.getId());
        assertThat(recuperado.getUsuario().getId()).isEqualTo(usuario.getId());
    }

    @Test
    void rejeitaOMesmoUsuarioDuasVezesNoMesmoProjeto() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-dup@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, usuario));

        assertThatThrownBy(() -> membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, usuario)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void existsByProjetoAndUsuarioDetectaMembroJaExistente() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-exists@escritor.io", Papel.COLABORADOR, 480));
        Usuario outroUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-exists@escritor.io", Papel.COLABORADOR, 480));
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projeto, usuario));

        assertThat(membroProjetoRepository.existsByProjetoAndUsuario(projeto, usuario)).isTrue();
        assertThat(membroProjetoRepository.existsByProjetoAndUsuario(projeto, outroUsuario)).isFalse();
    }

    @Test
    void findByUsuarioListaTodosOsProjetosDoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-lista@escritor.io", Papel.COLABORADOR, 480));
        Projeto projetoA = projetoRepository.saveAndFlush(novoProjeto("Sistema A"));
        Projeto projetoB = projetoRepository.saveAndFlush(novoProjeto("Sistema B"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoA, usuario));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoB, usuario));

        List<MembroProjeto> membros = membroProjetoRepository.findByUsuario(usuario);

        assertThat(membros).hasSize(2);
    }

    @Test
    void existsByProjetoInAndUsuarioDetectaSobreposicaoDeProjetos() {
        Usuario requisitante = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-sobrepoe@escritor.io", Papel.GESTOR, 480));
        Usuario alvo = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto-sobrepoe@escritor.io", Papel.COLABORADOR, 480));
        Usuario semProjetoEmComum =
                usuarioRepository.saveAndFlush(new Usuario("Caio Reis", "caio-sobrepoe@escritor.io", Papel.COLABORADOR, 480));
        Projeto projetoComum = projetoRepository.saveAndFlush(novoProjeto("Sistema Comum"));
        Projeto outroProjeto = projetoRepository.saveAndFlush(novoProjeto("Outro Sistema"));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoComum, requisitante));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(projetoComum, alvo));
        membroProjetoRepository.saveAndFlush(new MembroProjeto(outroProjeto, semProjetoEmComum));

        assertThat(membroProjetoRepository.existsByProjetoInAndUsuario(List.of(projetoComum), alvo)).isTrue();
        assertThat(membroProjetoRepository.existsByProjetoInAndUsuario(List.of(projetoComum), semProjetoEmComum)).isFalse();
    }
}
