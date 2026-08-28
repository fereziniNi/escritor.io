package io.escritor.presenca.apontamento.repository;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
class ApontamentoRepositoryIT {

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
    private ApontamentoRepository apontamentoRepository;

    private Card criarCard(Usuario usuario) {
        Equipe equipe = equipeRepository.saveAndFlush(new Equipe("Backend", null));
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null, equipe));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(quadro, "A fazer", 0, null));
        return cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario));
    }

    @Test
    void persisteERecuperaApontamento() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        Instant inicio = Instant.now();

        Apontamento salvo = apontamentoRepository.saveAndFlush(
                new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER));

        Apontamento recuperado = apontamentoRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperado.getCard().getId()).isEqualTo(card.getId());
        assertThat(recuperado.getFim()).isNull();
        assertThat(recuperado.getMinutos()).isNull();
    }

    @Test
    void encontraOTimerAbertoDoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        Instant inicio = Instant.now();
        apontamentoRepository.saveAndFlush(
                new Apontamento(usuario, card, inicio.minus(2, ChronoUnit.HOURS), inicio.minus(1, ChronoUnit.HOURS), null, OrigemApontamento.MANUAL));
        Apontamento timerAberto = apontamentoRepository.saveAndFlush(
                new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER));

        var encontrado = apontamentoRepository.findFirstByUsuarioAndFimIsNull(usuario);

        assertThat(encontrado).isPresent();
        assertThat(encontrado.get().getId()).isEqualTo(timerAberto.getId());
    }

    @Test
    void rejeitaDoisTimersAbertosParaOMesmoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        apontamentoRepository.saveAndFlush(new Apontamento(usuario, card, Instant.now(), null, null, OrigemApontamento.TIMER));
        Apontamento segundoTimer = new Apontamento(usuario, card, Instant.now(), null, null, OrigemApontamento.TIMER);

        assertThatThrownBy(() -> apontamentoRepository.saveAndFlush(segundoTimer))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejeitaFimAntesDoInicioEmBanco() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        Instant inicio = Instant.now();
        Apontamento invalido = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);
        // contorna a validação do construtor pra provar que o banco também garante a regra.
        ReflectionTestUtils.setField(invalido, "fim", inicio.minus(1, ChronoUnit.MINUTES));

        assertThatThrownBy(() -> apontamentoRepository.saveAndFlush(invalido))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
