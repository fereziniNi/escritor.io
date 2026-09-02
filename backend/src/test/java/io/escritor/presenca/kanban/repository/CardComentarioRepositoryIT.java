package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardComentario;
import io.escritor.presenca.kanban.domain.Coluna;
import java.time.LocalDate;
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
class CardComentarioRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoRepository projetoRepository;

    @Autowired
    private ColunaRepository colunaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private CardComentarioRepository cardComentarioRepository;

    @Test
    void persisteERecuperaComentario() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));

        CardComentario salvo = cardComentarioRepository.saveAndFlush(new CardComentario(card, "Já revisei", autor));

        CardComentario recuperado = cardComentarioRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getCard().getId()).isEqualTo(card.getId());
        assertThat(recuperado.getAutor().getId()).isEqualTo(autor.getId());
        assertThat(recuperado.getTexto()).isEqualTo("Já revisei");
    }

    @Test
    void listaComentariosDoCardEmOrdemCronologica() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));
        cardComentarioRepository.saveAndFlush(new CardComentario(card, "Primeiro", autor));
        cardComentarioRepository.saveAndFlush(new CardComentario(card, "Segundo", autor));

        var comentarios = cardComentarioRepository.findByCardOrderByCriadoEmAsc(card);

        assertThat(comentarios).hasSize(2);
        assertThat(comentarios.get(0).getTexto()).isEqualTo("Primeiro");
        assertThat(comentarios.get(1).getTexto()).isEqualTo("Segundo");
    }
}
