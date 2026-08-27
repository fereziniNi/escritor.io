package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
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
class ColunaRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private QuadroRepository quadroRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    @Test
    void persisteERecuperaColuna() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));

        Coluna salva = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));

        Coluna recuperada = colunaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getQuadro().getId()).isEqualTo(quadro.getId());
        assertThat(recuperada.getNome()).isEqualTo("A fazer");
        assertThat(recuperada.getOrdem()).isZero();
        assertThat(recuperada.getLimiteWip()).isNull();
    }

    @Test
    void rejeitaOrdemDuplicadaNoMesmoQuadro() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));

        Coluna duplicada = new Coluna(quadro, "Outra", 0, null);

        assertThatThrownBy(() -> colunaRepository.saveAndFlush(duplicada))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void permiteAMesmaOrdemEmQuadrosDiferentes() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadroA = quadroRepository.saveAndFlush(new Quadro("Backlog A", null, equipe));
        Quadro quadroB = quadroRepository.saveAndFlush(new Quadro("Backlog B", null, equipe));
        colunaRepository.saveAndFlush(new Coluna(quadroA, "A fazer", 0, null));

        Coluna colunaDeOutroQuadro = colunaRepository.saveAndFlush(new Coluna(quadroB, "A fazer", 0, null));

        assertThat(colunaDeOutroQuadro.getId()).isNotNull();
    }
}
