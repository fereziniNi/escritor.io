package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CardEventoTest {

    private final Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
    private final Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
    private final Usuario autor = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor);

    @Test
    void eventoDeCriacaoSemDe() {
        CardEvento evento = new CardEvento(card, autor, TipoEventoCard.CRIACAO, null, "A fazer");

        assertThat(evento.getCard()).isSameAs(card);
        assertThat(evento.getAutor()).isSameAs(autor);
        assertThat(evento.getTipo()).isEqualTo(TipoEventoCard.CRIACAO);
        assertThat(evento.getDe()).isNull();
        assertThat(evento.getPara()).isEqualTo("A fazer");
        assertThat(evento.getCriadoEm()).isNotNull();
    }

    @Test
    void eventoDeMudancaDeColunaComDeEPara() {
        CardEvento evento = new CardEvento(card, autor, TipoEventoCard.MUDANCA_COLUNA, "A fazer", "Em progresso");

        assertThat(evento.getTipo()).isEqualTo(TipoEventoCard.MUDANCA_COLUNA);
        assertThat(evento.getDe()).isEqualTo("A fazer");
        assertThat(evento.getPara()).isEqualTo("Em progresso");
    }
}
