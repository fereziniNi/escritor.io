package io.escritor.presenca.kanban.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Etiqueta é sempre de um quadro específico (PRD §3.3: `Etiqueta id, quadro_id, nome, cor`) - só
 * pode ser aplicada em cards desse mesmo quadro, nunca de outro (ver
 * {@link EtiquetaDeOutroQuadroException}, checado em {@code EtiquetaService.aplicar}, não aqui:
 * esta entidade sozinha não tem como saber a que card ela está sendo aplicada).
 */
@Entity
@Table(name = "etiqueta")
public class Etiqueta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "quadro_id", nullable = false)
    private Quadro quadro;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String cor;

    protected Etiqueta() {
        // JPA
    }

    public Etiqueta(Quadro quadro, String nome, String cor) {
        if (nome == null || nome.isBlank()) {
            throw new NomeEtiquetaObrigatorioException();
        }
        if (cor == null || cor.isBlank()) {
            throw new CorEtiquetaObrigatoriaException();
        }
        this.quadro = quadro;
        this.nome = nome;
        this.cor = cor;
    }

    public Long getId() {
        return id;
    }

    public Quadro getQuadro() {
        return quadro;
    }

    public String getNome() {
        return nome;
    }

    public String getCor() {
        return cor;
    }
}
