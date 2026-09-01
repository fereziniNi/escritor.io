package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Quadro;
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
class QuadroRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private QuadroRepository quadroRepository;

    @Test
    void persisteERecuperaQuadroDeProjeto() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Site novo", "Acme", StatusProjeto.ATIVO, LocalDate.now(), null));

        Quadro salvo = quadroRepository.saveAndFlush(new Quadro("Backlog", projeto));

        Quadro recuperado = quadroRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getProjeto().getId()).isEqualTo(projeto.getId());
        assertThat(recuperado.isArquivado()).isFalse();
    }

    /**
     * Pedido do cliente: sem Equipe - quadro (o "sistema") não precisa mais de vínculo nenhum, um
     * nome já basta (visibilidade agora é atribuição individual, ver {@code MembroQuadroRepositoryIT}).
     */
    @Test
    void persisteERecuperaQuadroSemProjeto() {
        Quadro salvo = quadroRepository.saveAndFlush(new Quadro("Interno", null));

        Quadro recuperado = quadroRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getProjeto()).isNull();
    }
}
