package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Papel papel;

    @Column(name = "carga_diaria_minutos", nullable = false)
    private Integer cargaDiariaMinutos;

    @Column(nullable = false)
    private boolean ativo;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Usuario() {
        // JPA
    }

    public Usuario(String nome, String email, Papel papel, Integer cargaDiariaMinutos) {
        this.nome = nome;
        this.email = email;
        this.papel = papel;
        this.cargaDiariaMinutos = cargaDiariaMinutos;
        this.ativo = true;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getEmail() {
        return email;
    }

    public Papel getPapel() {
        return papel;
    }

    public Integer getCargaDiariaMinutos() {
        return cargaDiariaMinutos;
    }

    /** Pedido do usuário: "o admin deve definir [a carga diária] para os outros funcionários, não
     * deve ser padrão" - antes só dava pra escolher na criação, sem jeito nenhum de mudar depois.
     * Validação de positivo fica só na camada web ({@code @Positive} em
     * {@code AtualizarCargaDiariaRequest}), mesmo padrão já usado no construtor deste tipo. */
    public void alterarCargaDiaria(Integer novaCargaDiariaMinutos) {
        this.cargaDiariaMinutos = novaCargaDiariaMinutos;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
