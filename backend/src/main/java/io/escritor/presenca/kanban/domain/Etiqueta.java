package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Projeto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Etiqueta é sempre de um projeto específico - só pode ser aplicada em cards desse mesmo
 * projeto, nunca de outro (ver {@link EtiquetaDeOutroProjetoException}, checado em
 * {@code EtiquetaService.aplicar}, não aqui: esta entidade sozinha não tem como saber a que card
 * ela está sendo aplicada).
 */
@Entity
@Table(name = "etiqueta")
public class Etiqueta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "projeto_id", nullable = false)
    private Projeto projeto;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String cor;

    protected Etiqueta() {
        // JPA
    }

    public Etiqueta(Projeto projeto, String nome, String cor) {
        if (nome == null || nome.isBlank()) {
            throw new NomeEtiquetaObrigatorioException();
        }
        if (cor == null || cor.isBlank()) {
            throw new CorEtiquetaObrigatoriaException();
        }
        this.projeto = projeto;
        this.nome = nome;
        this.cor = cor;
    }

    public Long getId() {
        return id;
    }

    public Projeto getProjeto() {
        return projeto;
    }

    public String getNome() {
        return nome;
    }

    public String getCor() {
        return cor;
    }
}
