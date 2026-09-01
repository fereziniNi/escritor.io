package io.escritor.presenca.kanban.domain;

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
 * Substitui {@code MembroEquipe} (pedido do cliente, via usuário: "sem equipes... vai atribuir
 * pessoas individuais aos devidos sistemas e atividades") - pessoa é atribuída direto a um Quadro
 * ("sistema"), sem a camada de Equipe no meio. Mesmo pacote de {@link Quadro}, mesma direção de
 * dependência já usada por {@link Card} (kanban depende de {@code identidade.Usuario}, nunca o
 * contrário). Sem {@code papel}/liderança de propósito: a regra de visibilidade nova (ver
 * {@code VisibilidadeUsuarioService}) é simétrica - um GESTOR enxerga quem mais está no mesmo
 * quadro que ele, não precisa ser "líder" de nada.
 */
@Entity
@Table(name = "membro_quadro")
public class MembroQuadro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "quadro_id", nullable = false)
    private Quadro quadro;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected MembroQuadro() {
        // JPA
    }

    public MembroQuadro(Quadro quadro, Usuario usuario) {
        this.quadro = quadro;
        this.usuario = usuario;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Quadro getQuadro() {
        return quadro;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
