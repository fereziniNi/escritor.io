package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Equipe;
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
 * {@code projeto} e/ou {@code equipe} - os dois nulos ao mesmo tempo é combinação inválida (PRD
 * §3.3), garantida aqui e reforçada por {@code ck_quadro_projeto_ou_equipe} na migração (ver
 * V12__create_quadro.sql) caso algum caminho futuro bypasse esta entidade.
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

    @ManyToOne
    @JoinColumn(name = "equipe_id")
    private Equipe equipe;

    @Column(nullable = false)
    private boolean arquivado;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Quadro() {
        // JPA
    }

    public Quadro(String nome, Projeto projeto, Equipe equipe) {
        if (nome == null || nome.isBlank()) {
            throw new NomeQuadroObrigatorioException();
        }
        if (projeto == null && equipe == null) {
            throw new QuadroSemVinculoException();
        }
        this.nome = nome;
        this.projeto = projeto;
        this.equipe = equipe;
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

    public Equipe getEquipe() {
        return equipe;
    }

    public boolean isArquivado() {
        return arquivado;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
