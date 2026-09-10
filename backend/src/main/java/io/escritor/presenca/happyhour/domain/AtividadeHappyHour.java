package io.escritor.presenca.happyhour.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Pedido do usuário: "ver as atividades para happy hour onde qualquer um pode adicionar uma nova
 * 'atividade' que poderá sugerir... uma parte para roleta onde será sorteado qual atividade será
 * feita" - lista aberta de sugestões (qualquer autenticado adiciona, sem edição/exclusão, mesma
 * simplificação de sempre nesse app pra ações desse tipo). {@code sorteadaEm} nulo significa
 * "nunca foi sorteada"; não-nulo marca a escolha ATUAL da roleta - só uma linha por vez tem esse
 * campo preenchido, garantido pelo {@code HappyHourService} (desmarca a anterior antes de marcar a
 * nova), não por constraint de banco.
 */
@Entity
@Table(name = "atividade_happy_hour")
public class AtividadeHappyHour {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String descricao;

    @ManyToOne(optional = false)
    @JoinColumn(name = "sugerida_por", nullable = false)
    private Usuario sugeridaPor;

    private Instant criadaEm;

    private Instant sorteadaEm;

    protected AtividadeHappyHour() {
        // JPA
    }

    public AtividadeHappyHour(String descricao, Usuario sugeridaPor, Instant criadaEm) {
        if (descricao == null || descricao.isBlank()) {
            throw new DescricaoAtividadeObrigatoriaException();
        }
        this.descricao = descricao;
        this.sugeridaPor = sugeridaPor;
        this.criadaEm = criadaEm;
    }

    public void sortear(Instant quando) {
        this.sorteadaEm = quando;
    }

    public void desmarcarSorteio() {
        this.sorteadaEm = null;
    }

    public Long getId() {
        return id;
    }

    public String getDescricao() {
        return descricao;
    }

    public Usuario getSugeridaPor() {
        return sugeridaPor;
    }

    public Instant getCriadaEm() {
        return criadaEm;
    }

    public Instant getSorteadaEm() {
        return sorteadaEm;
    }
}
