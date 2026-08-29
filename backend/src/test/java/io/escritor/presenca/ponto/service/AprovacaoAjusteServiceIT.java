package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prova, contra um Postgres real (com o REVOKE UPDATE/DELETE de V8 em vigor), que aprovar uma
 * solicitação de ajuste nunca toca o registro_ponto original: só faz INSERT do registro de
 * correção. Se algum código futuro tentasse fazer UPDATE no original, isso quebraria com
 * "permission denied" no banco, não só numa asserção de mock.
 */
@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AprovacaoAjusteServiceIT {

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
    void aprovarCriaRegistroDeCorrecaoSemAlterarOOriginal() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Usuario gestor = usuarioRepository.saveAndFlush(
                new Usuario("Beto Gestor", "beto@escritor.io", Papel.GESTOR, 480));

        RegistroPonto original = registroPontoRepository.saveAndFlush(new RegistroPonto(
                usuario,
                TipoRegistroPonto.ENTRADA,
                Instant.parse("2026-01-15T09:15:00Z"),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                null));
        String hashOriginalAntes = original.getHash();

        SolicitacaoAjustePonto solicitacao = solicitacaoAjustePontoRepository.saveAndFlush(new SolicitacaoAjustePonto(
                usuario,
                original,
                TipoRegistroPonto.ENTRADA,
                Instant.parse("2026-01-15T09:00:00Z"),
                "Bati às 9h, o relógio marcou 9h15 por engano"));

        Clock clock = Clock.fixed(Instant.parse("2026-01-16T10:00:00Z"), ZoneOffset.UTC);
        // null: este teste só exercita aprovar(), que nunca consulta VisibilidadeUsuarioService
        // (só listarPendentes usa, S5.6) - @DataJpaTest não sobe esse bean, sem sentido mockar.
        AprovacaoAjusteService service =
                new AprovacaoAjusteService(solicitacaoAjustePontoRepository, registroPontoRepository, null, clock);

        service.aprovar(solicitacao.getId(), gestor, "Confirmado com a portaria");

        RegistroPonto originalRecarregado = registroPontoRepository.findById(original.getId()).orElseThrow();
        assertThat(originalRecarregado.getMomento()).isEqualTo(Instant.parse("2026-01-15T09:15:00Z"));
        assertThat(originalRecarregado.getHash()).isEqualTo(hashOriginalAntes);
        assertThat(originalRecarregado.hashValido()).isTrue();

        var registros = registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(
                usuario, Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(registros).hasSize(2);
        RegistroPonto correcao = registros.stream()
                .filter(registro -> registro.getOrigem() == OrigemRegistroPonto.AJUSTE_APROVADO)
                .findFirst()
                .orElseThrow();
        assertThat(correcao.getSubstitui().getId()).isEqualTo(original.getId());
        assertThat(correcao.getMomento()).isEqualTo(Instant.parse("2026-01-15T09:00:00Z"));
        assertThat(correcao.getHashAnterior()).isEqualTo(hashOriginalAntes);
        assertThat(correcao.hashValido()).isTrue();

        SolicitacaoAjustePonto solicitacaoRecarregada =
                solicitacaoAjustePontoRepository.findById(solicitacao.getId()).orElseThrow();
        assertThat(solicitacaoRecarregada.getStatus()).isEqualTo(StatusSolicitacaoAjuste.APROVADA);
    }
}
