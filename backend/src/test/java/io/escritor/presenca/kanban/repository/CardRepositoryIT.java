package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardComentario;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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
class CardRepositoryIT {

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

    @Autowired
    private CardEventoRepository cardEventoRepository;

    @Autowired
    private SessaoTrabalhoRepository sessaoTrabalhoRepository;

    @Autowired
    private EntityManager entityManager;

    /** Pedido do usuário: "apagar de verdade - remove tudo do banco" (migração V53) - prova que a
     * cascata funciona de verdade contra um Postgres real, não só que o mock não reclama:
     * comentário, evento de histórico e sessão de trabalho do card precisam sumir junto, sem
     * violação de chave estrangeira nenhuma. {@code entityManager.clear()} antes de apagar:
     * `Card` não tem mapeamento JPA nenhum pra essas 3 entidades (a cascata é só no banco, de
     * propósito - ver comentário na migração V53), então sem limpar o contexto de persistência o
     * próprio Hibernate reclama de uma referência "órfã" no L1 cache antes mesmo de chegar no
     * banco - um falso positivo do ORM, não do banco de verdade. */
    @Test
    void apagarUmCardApagaComentarioEventoESessaoDeTrabalhoJunto() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        Card card = cardRepository.saveAndFlush(new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, autor));

        Long comentarioId = cardComentarioRepository.saveAndFlush(new CardComentario(card, "Comentário", autor)).getId();
        Long eventoId = cardEventoRepository.saveAndFlush(new CardEvento(card, autor, TipoEventoCard.CRIACAO, null, "A fazer")).getId();
        Long sessaoId = sessaoTrabalhoRepository.saveAndFlush(new SessaoTrabalho(card, autor, Instant.now())).getId();

        entityManager.clear();
        cardRepository.deleteById(card.getId());
        cardRepository.flush();

        assertThat(cardRepository.findById(card.getId())).isEmpty();
        assertThat(cardComentarioRepository.findById(comentarioId)).isEmpty();
        assertThat(cardEventoRepository.findById(eventoId)).isEmpty();
        assertThat(sessaoTrabalhoRepository.findById(sessaoId)).isEmpty();
    }

    @Test
    void persisteERecuperaCard() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));

        Card salvo = cardRepository.saveAndFlush(
                new Card(coluna, "Corrigir bug", "Descrição", 1024.0, null, null, null, autor));

        Card recuperado = cardRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getColuna().getId()).isEqualTo(coluna.getId());
        assertThat(recuperado.getTitulo()).isEqualTo("Corrigir bug");
        assertThat(recuperado.getCriadoPor().getId()).isEqualTo(autor.getId());
    }

    @Test
    void encontraOCardDeMaiorPosicaoNaColuna() {
        Projeto projeto = projetoRepository.saveAndFlush(new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null));
        Coluna coluna = colunaRepository.saveAndFlush(new Coluna(projeto, "A fazer", 0, null));
        Usuario autor = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480));
        cardRepository.saveAndFlush(new Card(coluna, "Primeiro", null, 1024.0, null, null, null, autor));
        cardRepository.saveAndFlush(new Card(coluna, "Segundo", null, 2048.0, null, null, null, autor));

        Card ultimo = cardRepository.findFirstByColunaOrderByPosicaoDesc(coluna).orElseThrow();

        assertThat(ultimo.getTitulo()).isEqualTo("Segundo");
    }
}
