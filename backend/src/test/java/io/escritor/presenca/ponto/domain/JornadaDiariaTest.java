package io.escritor.presenca.ponto.domain;

import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.ENTRADA;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.PAUSA_FIM;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.PAUSA_INICIO;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.SAIDA;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class JornadaDiariaTest {

    private static Marcacao marcacao(TipoRegistroPonto tipo, String horario) {
        return new Marcacao(tipo, Instant.parse("2026-01-15T" + horario + ":00Z"));
    }

    @Test
    void jornadaSimplesSemPausa() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(9 * 60);
        assertThat(JornadaDiaria.saldo(registros, 480)).isEqualTo(60);
    }

    @Test
    void descontaUmaPausa() {
        List<Marcacao> registros = List.of(
                marcacao(ENTRADA, "09:00"),
                marcacao(PAUSA_INICIO, "12:00"),
                marcacao(PAUSA_FIM, "13:00"),
                marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(8 * 60);
        assertThat(JornadaDiaria.saldo(registros, 480)).isZero();
    }

    @Test
    void descontaMultiplasPausas() {
        List<Marcacao> registros = List.of(
                marcacao(ENTRADA, "09:00"),
                marcacao(PAUSA_INICIO, "10:00"),
                marcacao(PAUSA_FIM, "10:15"),
                marcacao(PAUSA_INICIO, "12:00"),
                marcacao(PAUSA_FIM, "13:00"),
                marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(9 * 60 - 15 - 60);
    }

    @Test
    void pausaSemFimNaoContaComoTrabalhadaNemComoDesconto() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(PAUSA_INICIO, "12:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isZero();
    }

    @Test
    void entradaSemSaidaNaoContaMinutos() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isZero();
    }

    @Test
    void jornadaCruzandoMeiaNoiteSomaNormalmente() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T23:50:00Z")),
                new Marcacao(SAIDA, Instant.parse("2026-01-16T00:10:00Z")));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(20);
    }

    @Test
    void saldoPodeSerNegativo() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(SAIDA, "12:00"));

        assertThat(JornadaDiaria.saldo(registros, 480)).isEqualTo(3 * 60 - 480);
    }

    @Test
    void listaVaziaNaoTrabalhouNada() {
        assertThat(JornadaDiaria.minutosTrabalhados(List.of())).isZero();
    }

    @Test
    void segundosAteAgoraContaOSegmentoEmAndamentoAoContrarioDeMinutosTrabalhados() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"));
        Instant agora = Instant.parse("2026-01-15T09:00:07Z");

        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(registros, agora)).isEqualTo(7);
    }

    @Test
    void segundosAteAgoraFicaCongeladoDuranteUmaPausaEmAndamento() {
        // pausa começa 10s depois da entrada
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")),
                new Marcacao(PAUSA_INICIO, Instant.parse("2026-01-15T09:00:10Z")));

        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(registros, Instant.parse("2026-01-15T09:00:15Z"))).isEqualTo(10);
        // mesmo bem mais tarde na pausa, continua congelado nos mesmos 10s
        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(registros, Instant.parse("2026-01-15T09:05:00Z"))).isEqualTo(10);
    }

    @Test
    void segundosAteAgoraSomaTrechoAntesEDepoisDeUmaPausaJaEncerrada() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")),
                new Marcacao(PAUSA_INICIO, Instant.parse("2026-01-15T09:00:10Z")),
                new Marcacao(PAUSA_FIM, Instant.parse("2026-01-15T09:00:20Z")));

        // 10s trabalhados antes da pausa + 5s depois de voltar = 15s
        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(registros, Instant.parse("2026-01-15T09:00:25Z"))).isEqualTo(15);
    }

    @Test
    void segundosAteAgoraSomaUmDiaJaEncerradoMaisUmaNovaEntradaEmAndamento() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")),
                new Marcacao(SAIDA, Instant.parse("2026-01-15T09:00:30Z")),
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T10:00:00Z")));

        // 30s do primeiro turno (já fechado) + 10s do segundo (em andamento) = 40s
        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(registros, Instant.parse("2026-01-15T10:00:10Z"))).isEqualTo(40);
    }

    @Test
    void segundosAteAgoraDeQuemNuncaMarcouEZero() {
        assertThat(JornadaDiaria.segundosTrabalhadosAteAgora(List.of(), Instant.parse("2026-01-15T09:00:00Z"))).isZero();
    }
}
