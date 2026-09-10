package io.escritor.presenca.notificacao.domain;

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

/**
 * Pedido do usuário: "Não achei a parte da notificação dentro do sistema... quero ver as últimas
 * que chegaram no sistema" - até este pedido, os avisos em tempo real (convite de reunião, tarefa
 * concluída, nova tarefa, sorteio do Happy Hour) eram só um toast que some sozinho + som/pisca de
 * aba (ver {@code PresencaWebSocketHandler}), sem nenhum rastro - decisão explícita até aqui ("sem
 * inbox persistente de notificação neste app", comentário em {@code avisarNovaTarefa}), revertida
 * agora. {@link NotificacaoService#registrar} grava uma linha AO LADO do {@code avisarX} que já
 * existia, não em vez dele - o tempo real continua igual, isto só acrescenta o histórico.
 *
 * <p>{@code texto} já vem pronto (mesma frase que o toast usa, sem o emoji) - a central de
 * notificações não precisa saber montar frase nenhuma por tipo, só exibir. {@code link} é nulo
 * pra a maioria; só o convite de reunião carrega o link do Meet, pro item poder abrir direto
 * (mesmo espírito do botão "Entrar no Meet" que o toast já tem).
 */
@Entity
@Table(name = "notificacao")
public class Notificacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "destinatario_id", nullable = false)
    private Usuario destinatario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoNotificacao tipo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Column(length = 500)
    private String link;

    @Column(nullable = false)
    private boolean lida;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Notificacao() {
        // JPA
    }

    public Notificacao(Usuario destinatario, TipoNotificacao tipo, String texto, String link, Instant criadoEm) {
        this.destinatario = destinatario;
        this.tipo = tipo;
        this.texto = texto;
        this.link = link;
        this.lida = false;
        this.criadoEm = criadoEm;
    }

    public void marcarComoLida() {
        this.lida = true;
    }

    public Long getId() {
        return id;
    }

    public Usuario getDestinatario() {
        return destinatario;
    }

    public TipoNotificacao getTipo() {
        return tipo;
    }

    public String getTexto() {
        return texto;
    }

    public String getLink() {
        return link;
    }

    public boolean isLida() {
        return lida;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
