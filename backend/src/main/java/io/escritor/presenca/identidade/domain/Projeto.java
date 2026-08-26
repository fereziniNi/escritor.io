package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "projeto")
public class Projeto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String cliente;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusProjeto status;

    @Column(nullable = false)
    private LocalDate inicio;

    @Column(name = "fim_previsto")
    private LocalDate fimPrevisto;

    protected Projeto() {
        // JPA
    }

    public Projeto(String nome, String cliente, StatusProjeto status, LocalDate inicio, LocalDate fimPrevisto) {
        this.nome = nome;
        this.cliente = cliente;
        this.status = status;
        this.inicio = inicio;
        this.fimPrevisto = fimPrevisto;
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getCliente() {
        return cliente;
    }

    public StatusProjeto getStatus() {
        return status;
    }

    public LocalDate getInicio() {
        return inicio;
    }

    public LocalDate getFimPrevisto() {
        return fimPrevisto;
    }
}
