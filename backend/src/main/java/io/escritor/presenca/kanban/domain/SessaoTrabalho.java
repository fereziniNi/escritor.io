package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;

/**
 * Pedido do usuário: "deixe somente um contador de tempo onde a pessoa inicia, pausa e finaliza...
 * Isso engloba a tarefa inteira" - substitui o lançamento manual (minutos/intervalo digitados à
 * mão) por um cronômetro por {@link Card}: cada "Iniciar" abre uma sessão nova ({@code fim} nulo);
 * "Pausar"/"Finalizar" fecham a sessão aberta. Diferente do antigo {@code Apontamento}, uma sessão
 * nunca é criada/editada manualmente - só nasce/fecha pelas próprias ações do cronômetro
 * ({@code SessaoTrabalhoService}), por isso não tem `descricao` própria (a descrição agora é uma
 * só, gravada em {@link Card#getDescricaoConclusao()} ao finalizar a tarefa inteira).
 */
@Entity
@Table(name = "sessao_trabalho")
public class SessaoTrabalho {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    private Instant inicio;

    private Instant fim;

    protected SessaoTrabalho() {
        // JPA
    }

    public SessaoTrabalho(Card card, Usuario usuario, Instant inicio) {
        this.card = card;
        this.usuario = usuario;
        this.inicio = inicio;
    }

    public void pausar(Instant fim) {
        this.fim = fim;
    }

    /** Nulo enquanto a sessão está aberta (cronômetro rodando agora). */
    public Long getMinutos() {
        return fim == null ? null : Duration.between(inicio, fim).toMinutes();
    }

    public Long getId() {
        return id;
    }

    public Card getCard() {
        return card;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getInicio() {
        return inicio;
    }

    public Instant getFim() {
        return fim;
    }
}
