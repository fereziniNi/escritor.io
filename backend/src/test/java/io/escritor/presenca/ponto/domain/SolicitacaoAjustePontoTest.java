package io.escritor.presenca.ponto.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SolicitacaoAjustePontoTest {

    private final Usuario usuario = usuarioComId(1L);
    private final Instant momentoSolicitado = Instant.parse("2026-01-15T09:00:00Z");

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @Test
    void marcacaoEsquecidaNaoTemRegistroAlvo() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto na entrada");

        assertThat(solicitacao.getRegistroAlvo()).isNull();
        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.PENDENTE);
        assertThat(solicitacao.getJustificativa()).isEqualTo("Esqueci de bater o ponto na entrada");
    }

    @Test
    void correcaoDeRegistroExistenteReferenciaOAlvo() {
        RegistroPonto alvo = new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momentoSolicitado, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);

        var solicitacao = new SolicitacaoAjustePonto(
                usuario, alvo, TipoRegistroPonto.ENTRADA, momentoSolicitado.plusSeconds(600), "Bati errado, era 9h10");

        assertThat(solicitacao.getRegistroAlvo()).isSameAs(alvo);
    }

    @Test
    void justificativaEmBrancoLancaExcecao() {
        assertThatThrownBy(() ->
                        new SolicitacaoAjustePonto(usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "   "))
                .isInstanceOf(JustificativaObrigatoriaException.class);
    }

    @Test
    void justificativaNulaLancaExcecao() {
        assertThatThrownBy(() ->
                        new SolicitacaoAjustePonto(usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, null))
                .isInstanceOf(JustificativaObrigatoriaException.class);
    }

    @Test
    void statusInicialSempreEhPendenteMesmoQueTenteConstruirComOutro() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.SAIDA, momentoSolicitado, "Esqueci de bater a saída");

        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.PENDENTE);
        assertThat(solicitacao.getAvaliador()).isNull();
        assertThat(solicitacao.getAvaliadoEm()).isNull();
        assertThat(solicitacao.getParecer()).isNull();
    }

    @Test
    void aprovarMarcaStatusEAvaliador() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto");
        Usuario gestor = usuarioComId(2L);
        Instant agora = Instant.parse("2026-01-16T10:00:00Z");

        solicitacao.aprovar(gestor, agora, "Confirmado com o colaborador");

        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.APROVADA);
        assertThat(solicitacao.getAvaliador()).isSameAs(gestor);
        assertThat(solicitacao.getAvaliadoEm()).isEqualTo(agora);
        assertThat(solicitacao.getParecer()).isEqualTo("Confirmado com o colaborador");
    }

    @Test
    void aprovarSemParecerEhPermitido() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto");

        solicitacao.aprovar(usuarioComId(2L), Instant.parse("2026-01-16T10:00:00Z"), null);

        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.APROVADA);
        assertThat(solicitacao.getParecer()).isNull();
    }

    @Test
    void rejeitarExigeParecer() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto");

        assertThatThrownBy(() -> solicitacao.rejeitar(usuarioComId(2L), Instant.parse("2026-01-16T10:00:00Z"), "  "))
                .isInstanceOf(ParecerObrigatorioException.class);
        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.PENDENTE);
    }

    @Test
    void rejeitarComParecerMarcaStatus() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto");
        Usuario gestor = usuarioComId(2L);
        Instant agora = Instant.parse("2026-01-16T10:00:00Z");

        solicitacao.rejeitar(gestor, agora, "Sem registro de acesso ao prédio nesse horário");

        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.REJEITADA);
        assertThat(solicitacao.getAvaliador()).isSameAs(gestor);
        assertThat(solicitacao.getAvaliadoEm()).isEqualTo(agora);
        assertThat(solicitacao.getParecer()).isEqualTo("Sem registro de acesso ao prédio nesse horário");
    }

    @Test
    void naoConsegueAvaliarUmaSolicitacaoJaAvaliada() {
        var solicitacao = new SolicitacaoAjustePonto(
                usuario, null, TipoRegistroPonto.ENTRADA, momentoSolicitado, "Esqueci de bater o ponto");
        solicitacao.aprovar(usuarioComId(2L), Instant.parse("2026-01-16T10:00:00Z"), null);

        assertThatThrownBy(
                        () -> solicitacao.aprovar(usuarioComId(2L), Instant.parse("2026-01-17T10:00:00Z"), null))
                .isInstanceOf(SolicitacaoJaAvaliadaException.class);
        assertThatThrownBy(() -> solicitacao.rejeitar(
                        usuarioComId(2L), Instant.parse("2026-01-17T10:00:00Z"), "Mudei de ideia"))
                .isInstanceOf(SolicitacaoJaAvaliadaException.class);
    }
}
