package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CardComentarioTest {

    private final Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
    private final Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
    private final Usuario criadoPor = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);
    private final Usuario autor = new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480);

    @Test
    void comentarioValido() {
        CardComentario comentario = new CardComentario(card, "Já revisei, parece ok", autor);

        assertThat(comentario.getCard()).isSameAs(card);
        assertThat(comentario.getAutor()).isSameAs(autor);
        assertThat(comentario.getTexto()).isEqualTo("Já revisei, parece ok");
        assertThat(comentario.getCriadoEm()).isNotNull();
    }

    @Test
    void textoEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new CardComentario(card, "   ", autor)).isInstanceOf(TextoComentarioObrigatorioException.class);
    }

    @Test
    void textoNuloLancaExcecao() {
        assertThatThrownBy(() -> new CardComentario(card, null, autor)).isInstanceOf(TextoComentarioObrigatorioException.class);
    }
}
