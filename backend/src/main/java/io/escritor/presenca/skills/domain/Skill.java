package io.escritor.presenca.skills.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Pedido do usuário: catálogo de skills da Multiplica dentro do app, com versões e um selo
 * "Oficial" que exige aprovação de GESTOR/ADMIN para mudar. A skill em si só guarda o que não
 * muda a cada edição (slug imutável, selo, arquivamento, quem criou); o conteúdo vive nas
 * {@link SkillVersao}, e {@code versaoVigente} aponta para a que aparece, é copiada e baixada.
 */
@Entity
@Table(name = "skill")
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64, updatable = false)
    private String slug;

    @Column(nullable = false)
    private boolean oficial;

    @Column(nullable = false)
    private boolean arquivada;

    @OneToOne
    @JoinColumn(name = "versao_vigente_id")
    private SkillVersao versaoVigente;

    @ManyToOne(optional = false)
    @JoinColumn(name = "criada_por_id", nullable = false, updatable = false)
    private Usuario criadaPor;

    @Column(name = "criada_em", nullable = false, updatable = false)
    private Instant criadaEm;

    @Column(name = "hash_importado", length = 100)
    private String hashImportado;

    protected Skill() {
        // JPA
    }

    public Skill(String slug, Usuario criadaPor, Instant criadaEm) {
        this.slug = slug;
        this.criadaPor = criadaPor;
        this.criadaEm = criadaEm;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public boolean isOficial() {
        return oficial;
    }

    public boolean isArquivada() {
        return arquivada;
    }

    public SkillVersao getVersaoVigente() {
        return versaoVigente;
    }

    public Usuario getCriadaPor() {
        return criadaPor;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public String getHashImportado() {
        return hashImportado;
    }

    public void definirVigente(SkillVersao versao) {
        this.versaoVigente = versao;
    }

    public void marcarOficial(boolean oficial) {
        this.oficial = oficial;
    }

    public void marcarArquivada(boolean arquivada) {
        this.arquivada = arquivada;
    }

    public void registrarHashImportado(String hash) {
        this.hashImportado = hash;
    }
}
