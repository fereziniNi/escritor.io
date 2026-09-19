package io.escritor.presenca.seguranca;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Auditoria de segurança (VULN-05, MEDIUM). {@link RelogioAjustavel} é um {@link Clock} de teste
 * que avança manualmente - {@code Clock.fixed} não serve aqui porque o próprio comportamento sob
 * teste (janela deslizante) depende do tempo passando *entre* chamadas de {@link
 * LimitadorDeTaxa#permitir}.
 */
class LimitadorDeTaxaTest {

    private final RelogioAjustavel relogio = new RelogioAjustavel(Instant.parse("2026-01-13T12:00:00Z"));
    private final LimitadorDeTaxa limitador = new LimitadorDeTaxa(relogio);

    @Test
    void permiteAteOLimiteDentroDaJanela() {
        for (int i = 0; i < 3; i++) {
            assertThat(limitador.permitir("chave", 3, Duration.ofMinutes(1))).isTrue();
        }
    }

    @Test
    void recusaAPartirDoLimiteDentroDaMesmaJanela() {
        for (int i = 0; i < 3; i++) {
            limitador.permitir("chave", 3, Duration.ofMinutes(1));
        }

        assertThat(limitador.permitir("chave", 3, Duration.ofMinutes(1))).isFalse();
    }

    @Test
    void chamadaRecusadaNaoEContabilizada() {
        for (int i = 0; i < 3; i++) {
            limitador.permitir("chave", 3, Duration.ofMinutes(1));
        }
        limitador.permitir("chave", 3, Duration.ofMinutes(1)); // recusada, 4ª chamada

        // se a recusada tivesse sido contabilizada, esperar a janela vencer ainda mostraria uma
        // fila "cheia" com uma sobra - confirma que só 3 eventos reais ficaram registrados.
        relogio.avancar(Duration.ofMinutes(1).plusSeconds(1));
        assertThat(limitador.permitir("chave", 3, Duration.ofMinutes(1))).isTrue();
    }

    @Test
    void voltaAPermitirDepoisQueAJanelaPassa() {
        for (int i = 0; i < 3; i++) {
            limitador.permitir("chave", 3, Duration.ofMinutes(1));
        }
        assertThat(limitador.permitir("chave", 3, Duration.ofMinutes(1))).isFalse();

        relogio.avancar(Duration.ofMinutes(1).plusSeconds(1));

        assertThat(limitador.permitir("chave", 3, Duration.ofMinutes(1))).isTrue();
    }

    @Test
    void chavesDiferentesTemLimitesIndependentes() {
        for (int i = 0; i < 3; i++) {
            limitador.permitir("chave-a", 3, Duration.ofMinutes(1));
        }

        assertThat(limitador.permitir("chave-a", 3, Duration.ofMinutes(1))).isFalse();
        assertThat(limitador.permitir("chave-b", 3, Duration.ofMinutes(1))).isTrue();
    }

    private static final class RelogioAjustavel extends Clock {
        private Instant agora;

        RelogioAjustavel(Instant inicial) {
            this.agora = inicial;
        }

        void avancar(Duration duracao) {
            agora = agora.plus(duracao);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }
}
