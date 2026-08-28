package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEtiqueta;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Etiqueta;
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
class CardEtiquetaRepositoryIT {

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

    @Autowired
    private EtiquetaRepository etiquetaRepository;

    @Autowired
    private CardEtiquetaRepository cardEtiquetaRepository;

    @Test
    void persisteERecuperaVinculo() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));
        Etiqueta etiqueta = etiquetaRepository.saveAndFlush(new Etiqueta(quadro, "Urgente", "#FF0000"));

        cardEtiquetaRepository.saveAndFlush(new CardEtiqueta(card, etiqueta));

        assertThat(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).isTrue();
    }

    @Test
    void rejeitaEtiquetaDuplicadaNoMesmoCard() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));
        Etiqueta etiqueta = etiquetaRepository.saveAndFlush(new Etiqueta(quadro, "Urgente", "#FF0000"));
        cardEtiquetaRepository.saveAndFlush(new CardEtiqueta(card, etiqueta));

        CardEtiqueta duplicado = new CardEtiqueta(card, etiqueta);

        assertThatThrownBy(() -> cardEtiquetaRepository.saveAndFlush(duplicado))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void removeVinculoPorCardEEtiqueta() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));
        Etiqueta etiqueta = etiquetaRepository.saveAndFlush(new Etiqueta(quadro, "Urgente", "#FF0000"));
        cardEtiquetaRepository.saveAndFlush(new CardEtiqueta(card, etiqueta));

        cardEtiquetaRepository.deleteByCardAndEtiqueta(card, etiqueta);
        cardEtiquetaRepository.flush();

        assertThat(cardEtiquetaRepository.existsByCardAndEtiqueta(card, etiqueta)).isFalse();
    }
}
