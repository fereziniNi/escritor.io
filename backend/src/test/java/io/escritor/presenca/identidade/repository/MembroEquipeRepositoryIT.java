package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
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
class MembroEquipeRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private MembroEquipeRepository membroEquipeRepository;

    @Test
    void persisteERecuperaMembroDeEquipe() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));

        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, usuario, PapelNaEquipe.LIDER));

        assertThat(membroEquipeRepository.existsByEquipeAndUsuario(equipe, usuario)).isTrue();
    }

    @Test
    void rejeitaUsuarioDuplicadoNaMesmaEquipe() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));
        membroEquipeRepository.saveAndFlush(new MembroEquipe(equipe, usuario, PapelNaEquipe.MEMBRO));

        MembroEquipe duplicado = new MembroEquipe(equipe, usuario, PapelNaEquipe.LIDER);

        assertThatThrownBy(() -> membroEquipeRepository.saveAndFlush(duplicado))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
