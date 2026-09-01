package io.escritor.presenca.apontamento.repository;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
import java.time.Instant;
import java.time.LocalDate;
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
    private ProjetoRepository projetoRepository;

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
        Quadro quadro = quadroRepository.saveAndFlush(new Quadro("Backlog", null));
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

    @Test
    void encontraApontamentosFechadosDoUsuarioNoIntervaloEIgnoraTimerAbertoEOutroUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Usuario outroUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        Instant inicioDoDia = Instant.parse("2026-01-13T00:00:00Z");
        Instant fimDoDia = Instant.parse("2026-01-14T00:00:00Z");

        Apontamento dentroDoDia = apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, card, Instant.parse("2026-01-13T09:00:00Z"), Instant.parse("2026-01-13T10:00:00Z"), null, OrigemApontamento.MANUAL));
        // timer ainda aberto no mesmo dia - não deve entrar, mesmo com inicio dentro do intervalo.
        apontamentoRepository.saveAndFlush(new Apontamento(usuario, card, Instant.parse("2026-01-13T11:00:00Z"), null, null, OrigemApontamento.TIMER));
        // fechado, mas fora do intervalo do dia (dia seguinte).
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, card, Instant.parse("2026-01-14T09:00:00Z"), Instant.parse("2026-01-14T10:00:00Z"), null, OrigemApontamento.MANUAL));
        // fechado, dentro do intervalo, mas de outro usuário.
        apontamentoRepository.saveAndFlush(new Apontamento(
                outroUsuario, card, Instant.parse("2026-01-13T12:00:00Z"), Instant.parse("2026-01-13T13:00:00Z"), null, OrigemApontamento.MANUAL));

        var encontrados = apontamentoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
                usuario, inicioDoDia, fimDoDia);

        assertThat(encontrados).extracting(Apontamento::getId).containsExactly(dentroDoDia.getId());
    }

    @Test
    void encontraApontamentosDoUsuarioNoPeriodoIncluindoTimerAindaAberto() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Usuario outroUsuario = usuarioRepository.saveAndFlush(new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480));
        Card card = criarCard(usuario);
        Instant inicioDoPeriodo = Instant.parse("2026-01-01T00:00:00Z");
        Instant fimDoPeriodo = Instant.parse("2026-02-01T00:00:00Z");

        Apontamento fechado = apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, card, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        // timer ainda aberto no período - listagem/relatório (diferente da soma de S4.8) inclui.
        Apontamento aberto = apontamentoRepository.saveAndFlush(
                new Apontamento(usuario, card, Instant.parse("2026-01-20T09:00:00Z"), null, null, OrigemApontamento.TIMER));
        // fora do período.
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, card, Instant.parse("2026-02-15T09:00:00Z"), Instant.parse("2026-02-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        // dentro do período, mas de outro usuário.
        apontamentoRepository.saveAndFlush(new Apontamento(
                outroUsuario, card, Instant.parse("2026-01-16T09:00:00Z"), Instant.parse("2026-01-16T10:00:00Z"), null, OrigemApontamento.MANUAL));

        var encontrados = apontamentoRepository.findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(
                usuario, inicioDoPeriodo, fimDoPeriodo);

        assertThat(encontrados).extracting(Apontamento::getId).containsExactly(aberto.getId(), fechado.getId());
    }

    @Test
    void encontraApontamentosFechadosDeTodosOsCardsDoProjetoIgnorandoOutroProjeto() {
        Usuario usuario = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Projeto projetoA = projetoRepository.saveAndFlush(new Projeto("Projeto A", "Cliente", StatusProjeto.ATIVO, LocalDate.now(), null));
        Projeto projetoB = projetoRepository.saveAndFlush(new Projeto("Projeto B", "Cliente", StatusProjeto.ATIVO, LocalDate.now(), null));
        Quadro quadroA = quadroRepository.saveAndFlush(new Quadro("Quadro A", projetoA));
        Quadro quadroB = quadroRepository.saveAndFlush(new Quadro("Quadro B", projetoB));
        Coluna colunaA = colunaRepository.saveAndFlush(new Coluna(quadroA, "A fazer", 0, null));
        Coluna colunaB = colunaRepository.saveAndFlush(new Coluna(quadroB, "A fazer", 0, null));
        Card cardA = cardRepository.saveAndFlush(new Card(colunaA, "Card A", null, 1024.0, null, null, null, usuario));
        Card cardB = cardRepository.saveAndFlush(new Card(colunaB, "Card B", null, 1024.0, null, null, null, usuario));
        Apontamento doProjetoA = apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, cardA, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));
        apontamentoRepository.saveAndFlush(new Apontamento(
                usuario, cardB, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), null, OrigemApontamento.MANUAL));

        var encontrados = apontamentoRepository.findByCard_Coluna_Quadro_ProjetoAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
                projetoA, Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-02-01T00:00:00Z"));

        assertThat(encontrados).extracting(Apontamento::getId).containsExactly(doProjetoA.getId());
    }
}
