package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Coluna;
import java.time.LocalDate;
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
    private ProjetoRepository projetoRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    private static Projeto novoProjeto(String nome) {
        return new Projeto(nome, "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    }

    @Test
    void persisteERecuperaColuna() {
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));

        Coluna salva = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));

        Coluna recuperada = colunaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getProjeto().getId()).isEqualTo(projeto.getId());
        assertThat(recuperada.getNome()).isEqualTo("A fazer");
        assertThat(recuperada.getOrdem()).isZero();
        assertThat(recuperada.getLimiteWip()).isNull();
    }

    @Test
    void rejeitaOrdemDuplicadaNoMesmoProjeto() {
        Projeto projeto = projetoRepository.saveAndFlush(novoProjeto("Backlog"));
        colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));

        Coluna duplicada = new Coluna(projeto, "Outra", 0, null);

        assertThatThrownBy(() -> colunaRepository.saveAndFlush(duplicada))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void permiteAMesmaOrdemEmProjetosDiferentes() {
        Projeto projetoA = projetoRepository.saveAndFlush(novoProjeto("Backlog A"));
        Projeto projetoB = projetoRepository.saveAndFlush(novoProjeto("Backlog B"));
        colunaRepository.saveAndFlush(new Coluna(projetoA, "A fazer", 0, null));

        Coluna colunaDeOutroProjeto = colunaRepository.saveAndFlush(new Coluna(projetoB, "A fazer", 0, null));

        assertThat(colunaDeOutroProjeto.getId()).isNotNull();
    }
}
