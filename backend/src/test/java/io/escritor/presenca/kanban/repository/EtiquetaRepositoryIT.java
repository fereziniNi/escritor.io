package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Etiqueta;
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
class EtiquetaRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private EtiquetaRepository etiquetaRepository;

    private static Projeto novoProjeto(String nome) {
        return new Projeto(nome, "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    }

    @Test
    void persisteERecuperaEtiqueta() {
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));

        Etiqueta salva = etiquetaRepository.saveAndFlush(new Etiqueta(projeto, "Urgente", "#FF0000"));

        Etiqueta recuperada = etiquetaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getNome()).isEqualTo("Urgente");
        assertThat(recuperada.getCor()).isEqualTo("#FF0000");
        assertThat(recuperada.getProjeto().getId()).isEqualTo(projeto.getId());
    }

    @Test
    void listaEtiquetasDeUmProjetoENaoDeOutro() {
        Projeto projetoA = projetoRepository.saveAndFlush(novoProjeto("Backlog A"));
        Projeto projetoB = projetoRepository.saveAndFlush(novoProjeto("Backlog B"));
        etiquetaRepository.saveAndFlush(new Etiqueta(projetoA, "Urgente", "#FF0000"));
        etiquetaRepository.saveAndFlush(new Etiqueta(projetoB, "Bug", "#00FF00"));

        var etiquetasDoProjetoA = etiquetaRepository.findByProjetoOrderByNomeAsc(projetoA);

        assertThat(etiquetasDoProjetoA).hasSize(1);
        assertThat(etiquetasDoProjetoA.get(0).getNome()).isEqualTo("Urgente");
    }
}
