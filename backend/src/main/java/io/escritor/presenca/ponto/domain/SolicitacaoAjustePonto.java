package io.escritor.presenca.ponto.domain;

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
 * Diferente de {@link RegistroPonto}, esta tabela não é append-only: aprovar/rejeitar (S2.12)
 * faz um UPDATE em status/avaliador/avaliadoEm/parecer. A garantia de integridade do PRD é sobre
 * a marcação em si - aprovar uma solicitação nunca edita o {@code registroAlvo}, sempre insere um
 * {@link RegistroPonto} novo apontando pra ele.
 */
@Entity
@Table(name = "solicitacao_ajuste_ponto")
public class SolicitacaoAjustePonto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    /** {@code null} = marcação esquecida (não existe nenhum registro pra corrigir ainda). */
    @ManyToOne
    @JoinColumn(name = "registro_alvo_id")
    private RegistroPonto registroAlvo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_solicitado", nullable = false)
    private TipoRegistroPonto tipoSolicitado;

    @Column(name = "momento_solicitado", nullable = false)
    private Instant momentoSolicitado;

    @Column(nullable = false)
    private String justificativa;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusSolicitacaoAjuste status;

    @ManyToOne
    @JoinColumn(name = "avaliador_id")
    private Usuario avaliador;

    @Column(name = "avaliado_em")
    private Instant avaliadoEm;

    private String parecer;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected SolicitacaoAjustePonto() {
        // JPA
    }

    public SolicitacaoAjustePonto(
            Usuario usuario,
            RegistroPonto registroAlvo,
            TipoRegistroPonto tipoSolicitado,
            Instant momentoSolicitado,
            String justificativa) {
        if (justificativa == null || justificativa.isBlank()) {
            throw new JustificativaObrigatoriaException();
        }
        this.usuario = usuario;
        this.registroAlvo = registroAlvo;
        this.tipoSolicitado = tipoSolicitado;
        this.momentoSolicitado = momentoSolicitado;
        this.justificativa = justificativa;
        this.status = StatusSolicitacaoAjuste.PENDENTE;
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public RegistroPonto getRegistroAlvo() {
        return registroAlvo;
    }

    public TipoRegistroPonto getTipoSolicitado() {
        return tipoSolicitado;
    }

    public Instant getMomentoSolicitado() {
        return momentoSolicitado;
    }

    public String getJustificativa() {
        return justificativa;
    }

    public StatusSolicitacaoAjuste getStatus() {
        return status;
    }

    public Usuario getAvaliador() {
        return avaliador;
    }

    public Instant getAvaliadoEm() {
        return avaliadoEm;
    }

    public String getParecer() {
        return parecer;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
