package io.escritor.presenca.chat.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Pedido do usuário: "chat no sistema para os funcionários poderem conversar e o chefe conversar
 * com os funcionários, além de ter um grupo geral com todos os funcionários" - {@link
 * TipoConversa#DIRETA} cobre os dois primeiros (é a mesma coisa do ponto de vista do modelo: dois
 * usuários quaisquer, sem regra especial pro chefe), {@link TipoConversa#GERAL} é o terceiro. Sem
 * `nome` de propósito: DIRETA mostra o nome do outro participante (calculado em {@code
 * ChatService}, não guardado aqui) e GERAL é sempre "Geral" - nada aqui pede grupo customizado
 * ainda, então não existe onde guardar um nome escolhido.
 */
@Entity
@Table(name = "conversa")
public class Conversa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private TipoConversa tipo;

    private Instant criadoEm;

    protected Conversa() {
        // JPA
    }

    public Conversa(TipoConversa tipo, Instant criadoEm) {
        this.tipo = tipo;
        this.criadoEm = criadoEm;
    }

    public Long getId() {
        return id;
    }

    public TipoConversa getTipo() {
        return tipo;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
