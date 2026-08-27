package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.ProjetoEquipe;
import io.escritor.presenca.identidade.domain.StatusProjeto;
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
class ProjetoEquipeRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private ProjetoEquipeRepository projetoEquipeRepository;

    @Test
    void persisteERecuperaVinculo() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null));
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));

        projetoEquipeRepository.saveAndFlush(new ProjetoEquipe(projeto, equipe));

        assertThat(projetoEquipeRepository.existsByProjetoAndEquipe(projeto, equipe)).isTrue();
    }

    @Test
    void rejeitaVinculoDuplicado() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null));
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        projetoEquipeRepository.saveAndFlush(new ProjetoEquipe(projeto, equipe));

        ProjetoEquipe duplicado = new ProjetoEquipe(projeto, equipe);

        assertThatThrownBy(() -> projetoEquipeRepository.saveAndFlush(duplicado))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void listaVinculosDasEquipesInformadasENaoDeOutras() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null));
        Equipe equipeVinculada = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Equipe equipeNaoVinculada = equipeRepository.saveAndFlush(new Equipe("Frontend", null));
        projetoEquipeRepository.saveAndFlush(new ProjetoEquipe(projeto, equipeVinculada));

        var vinculos = projetoEquipeRepository.findByEquipeIn(List.of(equipeVinculada, equipeNaoVinculada));

        assertThat(vinculos).hasSize(1);
        assertThat(vinculos.get(0).getProjeto().getId()).isEqualTo(projeto.getId());
    }
}
