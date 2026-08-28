package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * PRD §3.3: `CardComentario id, card_id, autor_id, texto, criado_em`. Quem pode comentar (acesso
 * ao quadro do card) é checado no serviço ({@code CardComentarioService}), não aqui - esta
 * entidade não tem como saber quem está autenticado nem a regra de visibilidade do quadro.
 */
@Entity
@Table(name = "card_comentario")
public class CardComentario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @ManyToOne(optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected CardComentario() {
        // JPA
    }

    public CardComentario(Card card, String texto, Usuario autor) {
        if (texto == null || texto.isBlank()) {
            throw new TextoComentarioObrigatorioException();
        }
        this.card = card;
        this.texto = texto;
        this.autor = autor;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Card getCard() {
        return card;
    }

    public Usuario getAutor() {
        return autor;
    }

    public String getTexto() {
        return texto;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
