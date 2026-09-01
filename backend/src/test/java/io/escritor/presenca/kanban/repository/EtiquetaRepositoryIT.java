package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.kanban.domain.Etiqueta;
import io.escritor.presenca.kanban.domain.Quadro;
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
class EtiquetaRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private QuadroRepository quadroRepository;

    @Autowired
    private EtiquetaRepository etiquetaRepository;

    @Test
    void persisteERecuperaEtiqueta() {
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null));

        Etiqueta salva = etiquetaRepository.saveAndFlush(new Etiqueta(quadro, "Urgente", "#FF0000"));

        Etiqueta recuperada = etiquetaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getNome()).isEqualTo("Urgente");
        assertThat(recuperada.getCor()).isEqualTo("#FF0000");
        assertThat(recuperada.getQuadro().getId()).isEqualTo(quadro.getId());
    }

    @Test
    void listaEtiquetasDeUmQuadroENaoDeOutro() {
        Quadro quadroA = quadroRepository.saveAndFlush(new Quadro("Backlog A", null));
        Quadro quadroB = quadroRepository.saveAndFlush(new Quadro("Backlog B", null));
        etiquetaRepository.saveAndFlush(new Etiqueta(quadroA, "Urgente", "#FF0000"));
        etiquetaRepository.saveAndFlush(new Etiqueta(quadroB, "Bug", "#00FF00"));

        var etiquetasDoQuadroA = etiquetaRepository.findByQuadroOrderByNomeAsc(quadroA);

        assertThat(etiquetasDoQuadroA).hasSize(1);
        assertThat(etiquetasDoQuadroA.get(0).getNome()).isEqualTo("Urgente");
    }
}
