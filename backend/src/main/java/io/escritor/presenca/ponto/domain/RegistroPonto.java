package io.escritor.presenca.ponto.domain;

import io.escritor.presenca.identidade.domain.Usuario;
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
import java.time.Instant;
import java.util.Objects;

/**
 * Append-only: a tabela revoga UPDATE/DELETE para o papel de runtime da aplicação
 * (ver V8__create_registro_ponto.sql) - uma correção nunca edita este registro, sempre insere
 * um novo apontando pro original.
 */
@Entity
@Table(name = "registro_ponto")
public class RegistroPonto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoRegistroPonto tipo;

    @Column(nullable = false)
    private Instant momento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrigemRegistroPonto origem;

    private String ip;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "hash_anterior")
    private String hashAnterior;

    @Column(nullable = false)
    private String hash;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected RegistroPonto() {
        // JPA
    }

    public RegistroPonto(
            Usuario usuario,
            TipoRegistroPonto tipo,
            Instant momento,
            OrigemRegistroPonto origem,
            String ip,
            String userAgent,
            String hashAnterior) {
        this.usuario = usuario;
        this.tipo = tipo;
        this.momento = momento;
        this.origem = origem;
        this.ip = ip;
        this.userAgent = userAgent;
        this.hashAnterior = hashAnterior;
        this.hash = HashEncadeado.calcular(usuario.getId(), tipo, momento, origem, hashAnterior);
        this.criadoEm = Instant.now();
    }

    /**
     * Recalcula o hash a partir dos campos atuais e compara com o que está gravado. Se alguém
     * alterou um campo deste registro diretamente no banco (bypassando a aplicação), os dois
     * hashes não batem mais.
     */
    public boolean hashValido() {
        String esperado = HashEncadeado.calcular(usuario.getId(), tipo, momento, origem, hashAnterior);
        return Objects.equals(esperado, hash);
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public TipoRegistroPonto getTipo() {
        return tipo;
    }

    public Instant getMomento() {
        return momento;
    }

    public OrigemRegistroPonto getOrigem() {
        return origem;
    }

    public String getIp() {
        return ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getHashAnterior() {
        return hashAnterior;
    }

    public String getHash() {
        return hash;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
