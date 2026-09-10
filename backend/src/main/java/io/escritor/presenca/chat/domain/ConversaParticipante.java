package io.escritor.presenca.chat.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * Tabela de junção (mesmo molde de {@code reuniao.domain.ReuniaoParticipante}) + o marcador de
 * leitura de cada um ({@link #ultimaLeituraEm}, nulo até a pessoa abrir a conversa pela primeira
 * vez - toda mensagem conta como não lida nesse caso). Existir uma linha aqui é o que define
 * "participa dessa conversa": pra {@link TipoConversa#DIRETA} são sempre exatamente 2 (criadas
 * juntas em {@code ChatService#abrirConversaDireta}); pra {@link TipoConversa#GERAL} cada usuário
 * ganha a própria linha sob demanda (get-or-create, nunca em lote).
 */
@Entity
@Table(name = "conversa_participante", uniqueConstraints = @UniqueConstraint(columnNames = {"conversa_id", "usuario_id"}))
public class ConversaParticipante {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "conversa_id", nullable = false)
    private Conversa conversa;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    private Instant ultimaLeituraEm;

    protected ConversaParticipante() {
        // JPA
    }

    public ConversaParticipante(Conversa conversa, Usuario usuario) {
        this.conversa = conversa;
        this.usuario = usuario;
    }

    public void marcarLeituraEm(Instant instante) {
        this.ultimaLeituraEm = instante;
    }

    public Long getId() {
        return id;
    }

    public Conversa getConversa() {
        return conversa;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getUltimaLeituraEm() {
        return ultimaLeituraEm;
    }
}
