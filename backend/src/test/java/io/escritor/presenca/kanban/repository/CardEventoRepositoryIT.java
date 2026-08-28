package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
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
class CardEventoRepositoryIT {

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
    private CardEventoRepository cardEventoRepository;

    @Test
    void persisteERecuperaEvento() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));

        CardEvento salvo =
                cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.CRIACAO, null, "A fazer"));

        CardEvento recuperado = cardEventoRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getCard().getId()).isEqualTo(card.getId());
        assertThat(recuperado.getTipo()).isEqualTo(TipoEventoCard.CRIACAO);
        assertThat(recuperado.getDe()).isNull();
        assertThat(recuperado.getPara()).isEqualTo("A fazer");
    }

    @Test
    void listaEventosDoCardEmOrdemCronologica() {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna colunaA = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(colunaA, "Corrigir bug", null, 1024.0, null, null, null, autor));
        cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.CRIACAO, null, "A fazer"));
        cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.MUDANCA_COLUNA, "A fazer", "Em progresso"));

        var eventos = cardEventoRepository.findByCardOrderByCriadoEmAsc(card);

        assertThat(eventos).hasSize(2);
        assertThat(eventos.get(0).getTipo()).isEqualTo(TipoEventoCard.CRIACAO);
        assertThat(eventos.get(1).getTipo()).isEqualTo(TipoEventoCard.MUDANCA_COLUNA);
    }
}
