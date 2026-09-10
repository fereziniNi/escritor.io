package io.escritor.presenca.reuniao.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Pedido do usuário: "deixar disponível para entrar na reunião com quem ele quer dos
 * funcionários" - uma reunião pode ter vários convidados (espelha `attendees` da própria API de
 * eventos da Google, que já é uma lista). Tabela de junção simples, sem campo próprio além da
 * dupla reunião/usuário - não existe "papel do participante" nem "confirmou presença" ainda, fora
 * de escopo aqui.
 */
@Entity
@Table(name = "reuniao_participante", uniqueConstraints = @UniqueConstraint(columnNames = {"reuniao_id", "usuario_id"}))
public class ReuniaoParticipante {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "reuniao_id", nullable = false)
    private Reuniao reuniao;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    protected ReuniaoParticipante() {
        // JPA
    }

    public ReuniaoParticipante(Reuniao reuniao, Usuario usuario) {
        this.reuniao = reuniao;
        this.usuario = usuario;
    }

    public Long getId() {
        return id;
    }

    public Reuniao getReuniao() {
        return reuniao;
    }

    public Usuario getUsuario() {
        return usuario;
    }
}
