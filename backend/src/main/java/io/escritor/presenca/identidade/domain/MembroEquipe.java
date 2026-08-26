package io.escritor.presenca.identidade.domain;

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

@Entity
@Table(name = "membro_equipe")
public class MembroEquipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "equipe_id", nullable = false)
    private Equipe equipe;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "papel_na_equipe", nullable = false)
    private PapelNaEquipe papelNaEquipe;

    protected MembroEquipe() {
        // JPA
    }

    public MembroEquipe(Equipe equipe, Usuario usuario, PapelNaEquipe papelNaEquipe) {
        this.equipe = equipe;
        this.usuario = usuario;
        this.papelNaEquipe = papelNaEquipe;
    }

    public Long getId() {
        return id;
    }

    public Equipe getEquipe() {
        return equipe;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public PapelNaEquipe getPapelNaEquipe() {
        return papelNaEquipe;
    }
}
