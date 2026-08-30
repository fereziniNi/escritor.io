package io.escritor.presenca.escritorio.domain;

import io.escritor.presenca.identidade.domain.Usuario;
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
 * PRD §3.5: "opcional, só se quiser relatório de salas" - registro append-like de quanto tempo
 * cada usuário passou em cada zona, pra relatórios futuros (não usado por nenhuma fatia de tempo
 * real do E5; {@code PresencaWebSocketHandler} só grava aqui depois de já ter feito o broadcast
 * da posição/status pros clientes conectados, S6.12). {@code saiuEm} nulo = evento ainda aberto
 * (usuário segue na zona).
 */
@Entity
@Table(name = "evento_presenca")
public class EventoPresenca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(optional = false)
    @JoinColumn(name = "zona_id", nullable = false)
    private Zona zona;

    @Column(name = "entrou_em", nullable = false, updatable = false)
    private Instant entrouEm;

    @Column(name = "saiu_em")
    private Instant saiuEm;

    protected EventoPresenca() {
        // JPA
    }

    public EventoPresenca(Usuario usuario, Zona zona, Instant entrouEm) {
        this.usuario = usuario;
        this.zona = zona;
        this.entrouEm = entrouEm;
    }

    public void encerrar(Instant saiuEm) {
        this.saiuEm = saiuEm;
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Zona getZona() {
        return zona;
    }

    public Instant getEntrouEm() {
        return entrouEm;
    }

    public Instant getSaiuEm() {
        return saiuEm;
    }
}
