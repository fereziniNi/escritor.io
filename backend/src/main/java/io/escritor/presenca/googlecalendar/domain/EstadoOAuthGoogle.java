package io.escritor.presenca.googlecalendar.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Nonce opaco de uso único pra resolver com segurança "qual usuário está voltando do redirect da
 * Google" sem precisar colocar o token de acesso (mesmo sendo de 15min) numa URL de navegação de
 * página inteira - ver {@code GoogleOAuthService#iniciarConexao}/{@code tratarCallback}.
 */
@Entity
@Table(name = "estado_oauth_google")
public class EstadoOAuthGoogle {

    @Id
    private String nonce;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected EstadoOAuthGoogle() {
        // JPA
    }

    public EstadoOAuthGoogle(String nonce, Usuario usuario, Instant expiraEm, Instant agora) {
        this.nonce = nonce;
        this.usuario = usuario;
        this.expiraEm = expiraEm;
        this.criadoEm = agora;
    }

    public boolean estaExpirado(Instant agora) {
        return agora.isAfter(expiraEm);
    }

    public String getNonce() {
        return nonce;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getExpiraEm() {
        return expiraEm;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
