package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;

@Entity
@Table(name = "token_renovacao")
public class TokenRenovacao {

    private static final Duration VALIDADE = Duration.ofDays(30);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    @Column(name = "usado_em")
    private Instant usadoEm;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected TokenRenovacao() {
        // JPA
    }

    public TokenRenovacao(Usuario usuario, String tokenHash) {
        this.usuario = usuario;
        this.tokenHash = tokenHash;
        this.criadoEm = Instant.now();
        this.expiraEm = this.criadoEm.plus(VALIDADE);
    }

    public boolean estaExpirado(Instant agora) {
        return agora.isAfter(expiraEm);
    }

    public boolean estaUsado() {
        return usadoEm != null;
    }

    public void marcarUsado(Instant agora) {
        this.usadoEm = agora;
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getExpiraEm() {
        return expiraEm;
    }

    public Instant getUsadoEm() {
        return usadoEm;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
