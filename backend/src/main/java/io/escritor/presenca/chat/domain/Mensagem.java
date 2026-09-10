package io.escritor.presenca.chat.domain;

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

/** Uma mensagem de texto dentro de uma {@link Conversa} - pedido do usuário: "as mensagens devem
 * enviar e receber no mesmo momento que são enviadas". Sem edição/exclusão (fora de escopo, não
 * pedido) - uma vez criada, é imutável. */
@Entity
@Table(name = "mensagem")
public class Mensagem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "conversa_id", nullable = false)
    private Conversa conversa;

    @ManyToOne(optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(nullable = false, length = 2000)
    private String texto;

    private Instant criadoEm;

    protected Mensagem() {
        // JPA
    }

    public Mensagem(Conversa conversa, Usuario autor, String texto, Instant criadoEm) {
        this.conversa = conversa;
        this.autor = autor;
        this.texto = texto;
        this.criadoEm = criadoEm;
    }

    public Long getId() {
        return id;
    }

    public Conversa getConversa() {
        return conversa;
    }

    public Usuario getAutor() {
        return autor;
    }

    public String getTexto() {
        return texto;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
