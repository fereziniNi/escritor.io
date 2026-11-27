package io.escritor.presenca.skills.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Pedido do usuário: catálogo de skills com versões - fotografia imutável de uma skill (nome,
 * descrição, categoria, arquivos, prompt de uso, tutorial e mensagem da alteração). Salvar sempre
 * cria uma versão nova; só o {@code estado} e os dados da decisão (aprovar/rejeitar) mudam depois.
 * {@code autor} nulo = "Sistema" (importador das skills oficiais).
 */
@Entity
@Table(name = "skill_versao")
public class SkillVersao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "skill_id", nullable = false, updatable = false)
    private Skill skill;

    @Column(nullable = false, updatable = false)
    private int numero;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoVersao estado;

    @Column(nullable = false, length = 120, updatable = false)
    private String nome;

    @Column(nullable = false, columnDefinition = "TEXT", updatable = false)
    private String descricao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private CategoriaSkill categoria;

    @Column(name = "prompt_uso", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String promptUso;

    @Column(name = "tutorial_instalacao", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String tutorialInstalacao;

    @Column(nullable = false, columnDefinition = "TEXT", updatable = false)
    private String mensagem;

    @ManyToOne
    @JoinColumn(name = "autor_id", updatable = false)
    private Usuario autor;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm;

    @ManyToOne
    @JoinColumn(name = "decidida_por_id")
    private Usuario decididaPor;

    @Column(name = "decidida_em")
    private Instant decididaEm;

    @Column(name = "motivo_rejeicao", columnDefinition = "TEXT")
    private String motivoRejeicao;

    @OneToMany(mappedBy = "versao", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("caminho")
    private List<SkillArquivo> arquivos = new ArrayList<>();

    protected SkillVersao() {
        // JPA
    }

    public SkillVersao(Skill skill, int numero, EstadoVersao estado, String nome, String descricao,
            CategoriaSkill categoria, String promptUso, String tutorialInstalacao, String mensagem,
            Usuario autor, Instant criadaEm, List<ArquivoSkill> arquivos) {
        this.skill = skill;
        this.numero = numero;
        this.estado = estado;
        this.nome = nome;
        this.descricao = descricao;
        this.categoria = categoria;
        this.promptUso = promptUso;
        this.tutorialInstalacao = tutorialInstalacao;
        this.mensagem = mensagem;
        this.autor = autor;
        this.criadaEm = criadaEm;
        for (ArquivoSkill a : arquivos) {
            this.arquivos.add(new SkillArquivo(this, a.caminho(), a.conteudo()));
        }
    }

    /** Aprova a proposta: vira PUBLICADA (quem a torna vigente é a skill). */
    public void aprovar(Usuario por, Instant em) {
        this.estado = EstadoVersao.PUBLICADA;
        this.decididaPor = por;
        this.decididaEm = em;
    }

    public void rejeitar(Usuario por, Instant em, String motivo) {
        this.estado = EstadoVersao.REJEITADA;
        this.decididaPor = por;
        this.decididaEm = em;
        this.motivoRejeicao = motivo;
    }

    public List<ArquivoSkill> arquivosComoValor() {
        return arquivos.stream().map(a -> new ArquivoSkill(a.getCaminho(), a.getConteudo())).toList();
    }

    public Long getId() {
        return id;
    }

    public Skill getSkill() {
        return skill;
    }

    public int getNumero() {
        return numero;
    }

    public EstadoVersao getEstado() {
        return estado;
    }

    public String getNome() {
        return nome;
    }

    public String getDescricao() {
        return descricao;
    }

    public CategoriaSkill getCategoria() {
        return categoria;
    }

    public String getPromptUso() {
        return promptUso;
    }

    public String getTutorialInstalacao() {
        return tutorialInstalacao;
    }

    public String getMensagem() {
        return mensagem;
    }

    public Usuario getAutor() {
        return autor;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public Usuario getDecididaPor() {
        return decididaPor;
    }

    public Instant getDecididaEm() {
        return decididaEm;
    }

    public String getMotivoRejeicao() {
        return motivoRejeicao;
    }

    /** Arquivos ordenados por caminho. */
    public List<SkillArquivo> getArquivos() {
        return arquivos;
    }
}
