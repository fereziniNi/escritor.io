package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;
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
class ProjetoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

    @Test
    void persisteERecuperaProjeto() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto(
                "Portal do Cliente", "Acme Corp", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 15), null));

        Projeto recuperado = projetoRepository.findById(projeto.getId()).orElseThrow();

        assertThat(recuperado.getNome()).isEqualTo("Portal do Cliente");
        assertThat(recuperado.getCliente()).isEqualTo("Acme Corp");
        assertThat(recuperado.getStatus()).isEqualTo(StatusProjeto.ATIVO);
        assertThat(recuperado.getInicio()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(recuperado.getFimPrevisto()).isNull();
    }
}
