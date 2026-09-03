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
 * DELETE} de verdade são o caminho normal (S4.6). Desde a remoção do "Iniciar timer" (só ficam
 * lançamentos manuais - já nascem com {@code inicio}/{@code fim}/{@code minutos} completos), um
 * `fim` nulo só pode acontecer em registros legados de {@link OrigemApontamento#TIMER} de antes
 * dessa mudança.
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
     * PATCH parcial (S4.6): só os campos não-nulos passados mudam - {@code inicio}/{@code fim}
     * omitidos mantêm os valores atuais. Editando o intervalo, {@code minutos} é recalculado do
     * zero (nunca ajustado incrementalmente). Se o resultado ainda não tem {@code fim} (editando
     * um registro legado de timer aberto que ainda exista), continua sem `minutos`.
     */
    public void editar(Instant novoInicio, Instant novoFim, String novaDescricao) {
        Instant inicioFinal = novoInicio != null ? novoInicio : this.inicio;
        Instant fimFinal = novoFim != null ? novoFim : this.fim;
        if (fimFinal != null && fimFinal.isBefore(inicioFinal)) {
            throw new FimAntesDoInicioException();
        }

        this.inicio = inicioFinal;
        this.fim = fimFinal;
        this.minutos = fimFinal == null ? null : calcularMinutos(inicioFinal, fimFinal);
        if (novaDescricao != null) {
            this.descricao = novaDescricao;
        }
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
