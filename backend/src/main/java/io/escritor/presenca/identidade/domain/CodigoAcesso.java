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
@Table(name = "codigo_acesso")
public class CodigoAcesso {

    private static final Duration VALIDADE = Duration.ofMinutes(10);
    private static final int MAX_TENTATIVAS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "codigo_hash", nullable = false)
    private String codigoHash;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    @Column(name = "usado_em")
    private Instant usadoEm;

    @Column(nullable = false)
    private int tentativas;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected CodigoAcesso() {
        // JPA
    }

    public CodigoAcesso(Usuario usuario, String codigoHash) {
        this.usuario = usuario;
        this.codigoHash = codigoHash;
        this.criadoEm = Instant.now();
        this.expiraEm = this.criadoEm.plus(VALIDADE);
        this.tentativas = 0;
    }

    public boolean estaExpirado(Instant agora) {
        return agora.isAfter(expiraEm);
    }

    public boolean estaUsado() {
        return usadoEm != null;
    }

    public boolean excedeuTentativas() {
        return tentativas >= MAX_TENTATIVAS;
    }

    public void registrarTentativaFalha() {
        this.tentativas++;
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

    public String getCodigoHash() {
        return codigoHash;
    }

    public Instant getExpiraEm() {
        return expiraEm;
    }

    public Instant getUsadoEm() {
        return usadoEm;
    }

    public int getTentativas() {
        return tentativas;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
