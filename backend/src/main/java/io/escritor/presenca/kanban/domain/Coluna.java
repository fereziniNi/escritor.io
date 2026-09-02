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
 * {@code ordem} é única dentro do projeto (ver {@code uk_coluna_projeto_ordem} na migração,
 * V27__funde_quadro_em_projeto.sql) - a checagem em si de "já existe outra coluna deste projeto
 * com essa ordem" fica no serviço, porque exige olhar as colunas irmãs, não algo que esta
 * entidade sozinha consegue validar. {@code limiteWip} nulo = sem limite.
 */
@Entity
@Table(name = "coluna")
public class Coluna {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "projeto_id", nullable = false)
    private Projeto projeto;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "limite_wip")
    private Integer limiteWip;

    protected Coluna() {
        // JPA
    }

    public Coluna(Projeto projeto, String nome, int ordem, Integer limiteWip) {
        if (nome == null || nome.isBlank()) {
            throw new NomeColunaObrigatorioException();
        }
        if (limiteWip != null && limiteWip <= 0) {
            throw new LimiteWipInvalidoException();
        }
        this.projeto = projeto;
        this.nome = nome;
        this.ordem = ordem;
        this.limiteWip = limiteWip;
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

    public int getOrdem() {
        return ordem;
    }

    public Integer getLimiteWip() {
        return limiteWip;
    }
}
