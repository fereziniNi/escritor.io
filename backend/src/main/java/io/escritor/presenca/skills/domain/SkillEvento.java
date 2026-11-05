package io.escritor.presenca.skills.domain;

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
 * Pedido do usuário: catálogo de skills com histórico de quem fez o quê - oficializar e arquivar
 * não geram versão nova, então ficam registrados aqui (quem/quando/o quê).
 */
@Entity
@Table(name = "skill_evento")
public class SkillEvento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoEventoSkill tipo;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "ocorrido_em", nullable = false)
    private Instant ocorridoEm;

    @Column(columnDefinition = "TEXT")
    private String detalhe;

    protected SkillEvento() {
        // JPA
    }

    public SkillEvento(Skill skill, TipoEventoSkill tipo, Usuario usuario, Instant ocorridoEm, String detalhe) {
        this.skill = skill;
        this.tipo = tipo;
        this.usuario = usuario;
        this.ocorridoEm = ocorridoEm;
        this.detalhe = detalhe;
    }

    public Long getId() {
        return id;
    }

    public Skill getSkill() {
        return skill;
    }

    public TipoEventoSkill getTipo() {
        return tipo;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getOcorridoEm() {
        return ocorridoEm;
    }

    public String getDetalhe() {
        return detalhe;
    }
}
