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
 * {@code ordem} é única dentro do quadro (ver {@code uk_coluna_quadro_ordem} na migração,
 * V13__create_coluna.sql) - a checagem em si de "já existe outra coluna deste quadro com essa
 * ordem" fica no serviço, porque exige olhar as colunas irmãs, não algo que esta entidade sozinha
 * consegue validar. {@code limiteWip} nulo = sem limite.
 */
@Entity
@Table(name = "coluna")
public class Coluna {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "quadro_id", nullable = false)
    private Quadro quadro;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "limite_wip")
    private Integer limiteWip;

    protected Coluna() {
        // JPA
    }

    public Coluna(Quadro quadro, String nome, int ordem, Integer limiteWip) {
        if (nome == null || nome.isBlank()) {
            throw new NomeColunaObrigatorioException();
        }
        if (limiteWip != null && limiteWip <= 0) {
            throw new LimiteWipInvalidoException();
        }
        this.quadro = quadro;
        this.nome = nome;
        this.ordem = ordem;
        this.limiteWip = limiteWip;
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

    public int getOrdem() {
        return ordem;
    }

    public Integer getLimiteWip() {
        return limiteWip;
    }
}
