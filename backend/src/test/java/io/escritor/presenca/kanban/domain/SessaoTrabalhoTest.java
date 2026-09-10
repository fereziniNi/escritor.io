package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SessaoTrabalhoTest {

    private final Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    private final Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
    private final Card card = new Card(
            coluna, "Corrigir bug", null, 1024.0, null, null, null, new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
    private final Usuario usuario = new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480);

    @Test
    void nasceAbertaSemFimNemMinutos() {
        SessaoTrabalho sessao = new SessaoTrabalho(card, usuario, Instant.parse("2026-01-13T09:00:00Z"));

        assertThat(sessao.getCard()).isSameAs(card);
        assertThat(sessao.getUsuario()).isSameAs(usuario);
        assertThat(sessao.getInicio()).isEqualTo(Instant.parse("2026-01-13T09:00:00Z"));
        assertThat(sessao.getFim()).isNull();
        assertThat(sessao.getMinutos()).isNull();
    }

    @Test
    void pausarFechaASessaoECalculaOsMinutos() {
        SessaoTrabalho sessao = new SessaoTrabalho(card, usuario, Instant.parse("2026-01-13T09:00:00Z"));

        sessao.pausar(Instant.parse("2026-01-13T09:42:00Z"));

        assertThat(sessao.getFim()).isEqualTo(Instant.parse("2026-01-13T09:42:00Z"));
        assertThat(sessao.getMinutos()).isEqualTo(42);
    }
}
