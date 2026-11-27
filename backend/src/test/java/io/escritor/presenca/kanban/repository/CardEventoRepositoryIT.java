package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import java.time.Instant;
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
class CardEventoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

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
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
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
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna colunaA = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(colunaA, "Corrigir bug", null, 1024.0, null, null, null, autor));
        cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.CRIACAO, null, "A fazer"));
        cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.MUDANCA_COLUNA, "A fazer", "Em progresso"));

        var eventos = cardEventoRepository.findByCardOrderByCriadoEmAsc(card);

        assertThat(eventos).hasSize(2);
        assertThat(eventos.get(0).getTipo()).isEqualTo(TipoEventoCard.CRIACAO);
        assertThat(eventos.get(1).getTipo()).isEqualTo(TipoEventoCard.MUDANCA_COLUNA);
    }

    /** Atividade de tarefa pessoal nunca vaza pro resumo diário (WhatsApp). */
    @Test
    void eventosNaoIncluemCardDeProjetoPessoal() {
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Projeto normal = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Projeto pessoal = projetoRepository.saveAndFlush(Projeto.pessoalDe(ana, LocalDate.now()));
        Coluna colNormal = colunaRepository.saveAndFlush(new Coluna(normal, "A fazer", 0, null));
        Coluna colPessoal = colunaRepository.saveAndFlush(new Coluna(pessoal, "A fazer", 0, null));
        Card doNormal = cardRepository.saveAndFlush(new Card(colNormal, "Tarefa normal", null, 1024.0, ana, null, null, ana));
        Card doPessoal = cardRepository.saveAndFlush(new Card(colPessoal, "Tarefa pessoal", null, 1024.0, ana, null, null, ana));
        CardEvento eventoNormal = cardEventoRepository.saveAndFlush(new CardEvento(doNormal, ana, TipoEventoCard.CRIACAO, null, "A fazer"));
        cardEventoRepository.saveAndFlush(new CardEvento(doPessoal, ana, TipoEventoCard.CRIACAO, null, "A fazer"));

        Instant agora = Instant.now();
        var eventos = cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(
                agora.minusSeconds(3600), agora.plusSeconds(3600));

        assertThat(eventos).containsExactly(eventoNormal);
    }
}
