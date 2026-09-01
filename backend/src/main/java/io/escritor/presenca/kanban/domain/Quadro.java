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
import java.time.Instant;

/**
 * {@code projeto} é opcional, só uma categorização (pedido do cliente: sem Equipe - quem enxerga
 * o quadro/"sistema" é definido por atribuição individual, ver {@link MembroQuadro}, não mais por
 * vínculo a projeto/equipe). Antes desta mudança um quadro precisava ter projeto OU equipe; hoje
 * um nome já basta.
 */
@Entity
@Table(name = "quadro")
public class Quadro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @ManyToOne
    @JoinColumn(name = "projeto_id")
    private Projeto projeto;

    @Column(nullable = false)
    private boolean arquivado;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Quadro() {
        // JPA
    }

    public Quadro(String nome, Projeto projeto) {
        if (nome == null || nome.isBlank()) {
            throw new NomeQuadroObrigatorioException();
        }
        this.nome = nome;
        this.projeto = projeto;
        this.arquivado = false;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public Projeto getProjeto() {
        return projeto;
    }

    public boolean isArquivado() {
        return arquivado;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
