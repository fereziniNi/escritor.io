package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
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
class EquipeRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

    @Autowired
    private EquipeRepository equipeRepository;

    @Test
    void persisteERecuperaEquipe() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", "Time de backend"));

        Equipe recuperada = equipeRepository.findById(equipe.getId()).orElseThrow();

        assertThat(recuperada.getNome()).isEqualTo("Backend");
        assertThat(recuperada.getDescricao()).isEqualTo("Time de backend");
        assertThat(recuperada.isAtiva()).isTrue();
    }
}
