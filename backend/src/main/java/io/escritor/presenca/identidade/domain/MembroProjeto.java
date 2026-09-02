package io.escritor.presenca.identidade.domain;

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
 * Substitui {@code MembroQuadro} (pedido do cliente, via usuário: "remova essa parte de quadro,
 * vamos trabalhar apenas com projeto") - Quadro deixou de existir como conceito separado, Projeto
 * virou o próprio quadro de trabalho, e esta é a atribuição individual pessoa -> projeto que
 * decide quem enxerga o quê ({@code VisibilidadeUsuarioService}). Mesmo pacote de {@link Projeto}
 * (diferente de {@code MembroQuadro}, que precisou viver em {@code kanban.domain} porque
 * {@code Quadro} vivia lá) - aqui não há esse problema, {@link Projeto} já é deste pacote. Sem
 * {@code papel}/liderança de propósito, mesma simplicidade de antes: a atribuição em si já é a
 * regra de visibilidade.
 */
@Entity
@Table(name = "membro_projeto")
public class MembroProjeto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "projeto_id", nullable = false)
    private Projeto projeto;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected MembroProjeto() {
        // JPA
    }

    public MembroProjeto(Projeto projeto, Usuario usuario) {
        this.projeto = projeto;
        this.usuario = usuario;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Projeto getProjeto() {
        return projeto;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
