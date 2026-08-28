package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * PRD §3.3: `CardEvento id, card_id, autor_id, tipo, de, para, criado_em -- histórico`. Escrito
 * só por {@code CardService} (S3.17: "mover um card gera o evento sozinho, dentro do mesmo
 * serviço que move - nunca é escrito manualmente por outra camada"); não existe um endpoint
 * público de "criar evento". {@code de}/{@code para} guardam o rótulo legível no momento do
 * evento (ex.: nome da coluna), não um id - o histórico continua legível mesmo se a coluna for
 * renomeada ou removida depois.
 */
@Entity
@Table(name = "card_evento")
public class CardEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @ManyToOne(optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEventoCard tipo;

    @Column(name = "de")
    private String de;

    @Column(name = "para")
    private String para;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected CardEvento() {
        // JPA
    }

    public CardEvento(Card card, Usuario autor, TipoEventoCard tipo, String de, String para) {
        this.card = card;
        this.autor = autor;
        this.tipo = tipo;
        this.de = de;
        this.para = para;
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

    public TipoEventoCard getTipo() {
        return tipo;
    }

    public String getDe() {
        return de;
    }

    public String getPara() {
        return para;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
