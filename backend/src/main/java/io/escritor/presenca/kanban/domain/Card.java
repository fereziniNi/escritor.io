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
import java.time.LocalDate;

/**
 * {@code posicao} é fracionária (PRD §3.3) - quem calcula onde encaixar é
 * {@link CalculadoraPosicao}, não esta entidade. {@code responsavel}/{@code prazo}/
 * {@code estimativaMinutos} são opcionais; {@code criadoPor} nunca vem do cliente (mesmo padrão
 * de "servidor controla, não o cliente" já usado em ponto - resolvido via
 * {@code ContextoUsuarioAutenticado} no serviço).
 */
@Entity
@Table(name = "card")
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "coluna_id", nullable = false)
    private Coluna coluna;

    @Column(nullable = false)
    private String titulo;

    @Column(columnDefinition = "TEXT")
    private String descricao;

    @Column(nullable = false)
    private double posicao;

    @ManyToOne
    @JoinColumn(name = "responsavel_id")
    private Usuario responsavel;

    private LocalDate prazo;

    @Column(name = "estimativa_minutos")
    private Integer estimativaMinutos;

    @ManyToOne(optional = false)
    @JoinColumn(name = "criado_por", nullable = false)
    private Usuario criadoPor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(nullable = false)
    private boolean arquivado;

    /** Pedido do usuário: "descreve o que foi feito quando finaliza a tarefa" - uma descrição só,
     * da tarefa inteira (diferente de {@link #descricao}, que é sobre o que a tarefa É, definida
     * na criação), gravada por {@code SessaoTrabalhoService#finalizar}. */
    @Column(name = "descricao_conclusao", columnDefinition = "TEXT")
    private String descricaoConclusao;

    @Column(name = "concluido_em")
    private Instant concluidoEm;

    protected Card() {
        // JPA
    }

    public Card(
            Coluna coluna,
            String titulo,
            String descricao,
            double posicao,
            Usuario responsavel,
            LocalDate prazo,
            Integer estimativaMinutos,
            Usuario criadoPor) {
        if (titulo == null || titulo.isBlank()) {
            throw new TituloCardObrigatorioException();
        }
        if (estimativaMinutos != null && estimativaMinutos <= 0) {
            throw new EstimativaInvalidaException();
        }
        this.coluna = coluna;
        this.titulo = titulo;
        this.descricao = descricao;
        this.posicao = posicao;
        this.responsavel = responsavel;
        this.prazo = prazo;
        this.estimativaMinutos = estimativaMinutos;
        this.criadoPor = criadoPor;
        this.criadoEm = Instant.now();
        this.arquivado = false;
    }

    public Long getId() {
        return id;
    }

    public Coluna getColuna() {
        return coluna;
    }

    public String getTitulo() {
        return titulo;
    }

    public String getDescricao() {
        return descricao;
    }

    public double getPosicao() {
        return posicao;
    }

    public Usuario getResponsavel() {
        return responsavel;
    }

    public LocalDate getPrazo() {
        return prazo;
    }

    public Integer getEstimativaMinutos() {
        return estimativaMinutos;
    }

    public Usuario getCriadoPor() {
        return criadoPor;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public boolean isArquivado() {
        return arquivado;
    }

    public String getDescricaoConclusao() {
        return descricaoConclusao;
    }

    public Instant getConcluidoEm() {
        return concluidoEm;
    }

    /**
     * Diferente de {@code RegistroPonto}, {@code Card} não é append-only - mover é um `UPDATE`
     * de verdade (PRD E2: "arrastar cards entre colunas, com a mudança persistida"). Quem calcula
     * {@code novaPosicao} é o serviço (via {@link CalculadoraPosicao}), não esta entidade.
     */
    public void mover(Coluna novaColuna, double novaPosicao) {
        this.coluna = novaColuna;
        this.posicao = novaPosicao;
    }

    /** Pedido do usuário: "descreve o que foi feito quando finaliza a tarefa" - chamado por
     * {@code SessaoTrabalhoService#finalizar}, uma vez só (o próprio serviço rejeita finalizar de
     * novo checando {@link #getConcluidoEm()} antes de chamar isto). */
    public void finalizar(String descricaoConclusao, Instant quando) {
        this.descricaoConclusao = descricaoConclusao;
        this.concluidoEm = quando;
    }
}
