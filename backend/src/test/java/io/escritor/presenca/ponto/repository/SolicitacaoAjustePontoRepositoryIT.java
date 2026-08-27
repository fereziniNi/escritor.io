package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
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
class SolicitacaoAjustePontoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private RegistroPontoRepository registroPontoRepository;

    @Autowired
    private SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;

    @Test
    void persisteERecuperaMarcacaoEsquecidaSemRegistroAlvo() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Instant momento = Instant.parse("2026-01-15T09:00:00Z");

        SolicitacaoAjustePonto salva = solicitacaoAjustePontoRepository.saveAndFlush(
                new SolicitacaoAjustePonto(usuario, null, TipoRegistroPonto.ENTRADA, momento, "Esqueci de bater o ponto"));

        SolicitacaoAjustePonto recuperada = solicitacaoAjustePontoRepository.findById(salva.getId()).orElseThrow();

        assertThat(recuperada.getUsuario().getId()).isEqualTo(usuario.getId());
        assertThat(recuperada.getRegistroAlvo()).isNull();
        assertThat(recuperada.getTipoSolicitado()).isEqualTo(TipoRegistroPonto.ENTRADA);
        assertThat(recuperada.getMomentoSolicitado()).isEqualTo(momento);
        assertThat(recuperada.getJustificativa()).isEqualTo("Esqueci de bater o ponto");
        assertThat(recuperada.getStatus()).isEqualTo(StatusSolicitacaoAjuste.PENDENTE);
        assertThat(recuperada.getAvaliador()).isNull();
        assertThat(recuperada.getCriadoEm()).isNotNull();
    }

    @Test
    void persisteERecuperaCorrecaoComRegistroAlvo() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Instant momento = Instant.parse("2026-01-15T09:00:00Z");

        RegistroPonto alvo = registroPontoRepository.saveAndFlush(new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null));

        SolicitacaoAjustePonto salva = solicitacaoAjustePontoRepository.saveAndFlush(new SolicitacaoAjustePonto(
                usuario, alvo, TipoRegistroPonto.ENTRADA, momento.plusSeconds(600), "Bati errado, era 9h10"));

        SolicitacaoAjustePonto recuperada = solicitacaoAjustePontoRepository.findById(salva.getId()).orElseThrow();

        assertThat(recuperada.getRegistroAlvo().getId()).isEqualTo(alvo.getId());
    }
}
