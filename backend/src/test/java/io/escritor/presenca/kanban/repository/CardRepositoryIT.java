package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
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
class CardRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private EquipeRepository equipeRepository;

    @Autowired
    private QuadroRepository quadroRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CardRepository cardRepository;

    @Test
    void persisteERecuperaCard() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));

        Card salvo = cardRepository.saveAndFlush(
                new Card(coluna, "Corrigir bug", "Descrição", 1024.0, null, null, null, autor));

        Card recuperado = cardRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getColuna().getId()).isEqualTo(coluna.getId());
        assertThat(recuperado.getTitulo()).isEqualTo("Corrigir bug");
        assertThat(recuperado.getCriadoPor().getId()).isEqualTo(autor.getId());
    }

    @Test
    void encontraOCardDeMaiorPosicaoNaColuna() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        cardRepository.saveAndFlush(new Card(coluna, "Primeiro", null, 1024.0, null, null, null, autor));
        cardRepository.saveAndFlush(new Card(coluna, "Segundo", null, 2048.0, null, null, null, autor));

        Card ultimo = cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna).orElseThrow();

        assertThat(ultimo.getTitulo()).isEqualTo("Segundo");
    }
}
