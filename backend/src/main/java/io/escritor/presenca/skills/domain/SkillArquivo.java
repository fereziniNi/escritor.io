package io.escritor.presenca.skills.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Pedido do usuário: catálogo de skills - um arquivo (texto UTF-8) dentro de uma versão da skill.
 * Pertence à {@link SkillVersao} (cascade a partir dela); imutável depois de gravado.
 */
@Entity
@Table(name = "skill_arquivo")
public class SkillArquivo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "versao_id", nullable = false, updatable = false)
    private SkillVersao versao;

    @Column(nullable = false, length = 200, updatable = false)
    private String caminho;

    @Column(nullable = false, columnDefinition = "TEXT", updatable = false)
    private String conteudo;

    protected SkillArquivo() {
        // JPA
    }

    public SkillArquivo(SkillVersao versao, String caminho, String conteudo) {
        this.versao = versao;
        this.caminho = caminho;
        this.conteudo = conteudo;
    }

    public Long getId() {
        return id;
    }

    public SkillVersao getVersao() {
        return versao;
    }

    public String getCaminho() {
        return caminho;
    }

    public String getConteudo() {
        return conteudo;
    }
}
