package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Quadro;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class QuadroRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private QuadroRepository quadroRepository;

    @Test
    void persisteERecuperaQuadroDeProjeto() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Site novo", "Acme", StatusProjeto.ATIVO, LocalDate.now(), null));

        Quadro salvo = quadroRepository.saveAndFlush(new Quadro("Backlog", projeto, null));

        Quadro recuperado = quadroRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getProjeto().getId()).isEqualTo(projeto.getId());
        assertThat(recuperado.getEquipe()).isNull();
        assertThat(recuperado.isArquivado()).isFalse();
    }

    @Test
    void persisteERecuperaQuadroDeEquipe() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));

        Quadro salvo = quadroRepository.saveAndFlush(new Quadro("Interno", null, equipe));

        Quadro recuperado = quadroRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getEquipe().getId()).isEqualTo(equipe.getId());
        assertThat(recuperado.getProjeto()).isNull();
    }

    /**
     * A entidade já recusa construir um Quadro sem projeto nem equipe (QuadroTest), mas essa
     * constraint de banco é o que garante a regra mesmo se algum caminho futuro bypassar a
     * entidade Java - mesma filosofia do REVOKE em registro_ponto (ver architecture.md §2.3).
     * Usa reflection pra forçar os dois campos nulos depois de já ter passado pela validação do
     * construtor.
     */
    @Test
    void quadroSemProjetoNemEquipeNuncaPersisteMesmoBypassandoAEntidade() {
        Projeto projeto = projetoRepository.saveAndFlush(
                new Projeto("Site novo", "Acme", StatusProjeto.ATIVO, LocalDate.now(), null));
        Quadro invalido = new Quadro("Órfão", projeto, null);
        ReflectionTestUtils.setField(invalido, "projeto", null);

        assertThatThrownBy(() -> quadroRepository.saveAndFlush(invalido))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
