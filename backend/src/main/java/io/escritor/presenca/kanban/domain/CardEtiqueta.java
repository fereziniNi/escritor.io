package io.escritor.presenca.kanban.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Vínculo N:N entre {@link Card} e {@link Etiqueta} (PRD §3.3: `CardEtiqueta card_id,
 * etiqueta_id`) - mesmo formato de {@code MembroProjeto}: entidade própria com id gerado, não
 * uma chave composta, e a unicidade (card_id, etiqueta_id) é garantida em banco
 * ({@code uk_card_etiqueta_card_etiqueta}, V16), provada em {@code CardEtiquetaRepositoryIT}.
 */
@Entity
@Table(name = "card_etiqueta")
public class CardEtiqueta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @ManyToOne(optional = false)
    @JoinColumn(name = "etiqueta_id", nullable = false)
    private Etiqueta etiqueta;

    protected CardEtiqueta() {
        // JPA
    }

    public CardEtiqueta(Card card, Etiqueta etiqueta) {
        this.card = card;
        this.etiqueta = etiqueta;
    }

    public Long getId() {
        return id;
    }

    public Card getCard() {
        return card;
    }

    public Etiqueta getEtiqueta() {
        return etiqueta;
    }
}
