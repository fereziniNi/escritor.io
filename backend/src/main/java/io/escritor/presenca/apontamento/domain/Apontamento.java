package io.escritor.presenca.apontamento.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
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
import java.time.Duration;
import java.time.Instant;

/**
 * PRD §3.4: diferente de {@code RegistroPonto} (E1), apontamento é editável de propósito - "é
 * dado de gestão, não de jornada". Sem `REVOKE`/hash encadeado aqui: {@code UPDATE}/{@code
 * DELETE} de verdade são o caminho normal (S4.6). {@code fim} nulo = timer rodando; {@code
 * minutos} só existe depois de encerrado ({@link #encerrar}), nunca calculado antecipadamente.
 */
@Entity
@Table(name = "apontamento")
public class Apontamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @Column(nullable = false)
    private Instant inicio;

    private Instant fim;

    private Integer minutos;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrigemApontamento origem;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "editado_em", nullable = false)
    private Instant editadoEm;

    protected Apontamento() {
        // JPA
    }

    public Apontamento(Usuario usuario, Card card, Instant inicio, Instant fim, String descricao, OrigemApontamento origem) {
        if (fim != null && fim.isBefore(inicio)) {
            throw new FimAntesDoInicioException();
        }
        this.usuario = usuario;
        this.card = card;
        this.inicio = inicio;
        this.fim = fim;
        this.minutos = fim == null ? null : calcularMinutos(inicio, fim);
        this.descricao = descricao;
        this.origem = origem;
        this.criadoEm = Instant.now();
        this.editadoEm = this.criadoEm;
    }

    /**
     * Encerra um timer aberto (S4.3) - {@code fim}/{@code minutos} só nascem aqui pra quem foi
     * criado sem eles. Um apontamento já encerrado não pode ser encerrado de novo (use edição,
     * S4.6, pra corrigir um `fim` já existente).
     */
    public void encerrar(Instant fim) {
        if (this.fim != null) {
            throw new ApontamentoJaEncerradoException();
        }
        if (fim.isBefore(this.inicio)) {
            throw new FimAntesDoInicioException();
        }
        this.fim = fim;
        this.minutos = calcularMinutos(this.inicio, fim);
        this.editadoEm = Instant.now();
    }

    private static int calcularMinutos(Instant inicio, Instant fim) {
        return (int) Duration.between(inicio, fim).toMinutes();
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Card getCard() {
        return card;
    }

    public Instant getInicio() {
        return inicio;
    }

    public Instant getFim() {
        return fim;
    }

    public Integer getMinutos() {
        return minutos;
    }

    public String getDescricao() {
        return descricao;
    }

    public OrigemApontamento getOrigem() {
        return origem;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getEditadoEm() {
        return editadoEm;
    }
}
