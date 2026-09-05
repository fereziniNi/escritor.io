package io.escritor.presenca.escala.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Exceção pontual pra uma data específica - pedido do usuário: "poder mudar também o dia e hora".
 * {@code trabalha=false} é uma folga nessa data mesmo que {@link EscalaSemanal} diga que
 * normalmente trabalharia; {@code trabalha=true} exige horário, que vale só pra essa data (não
 * altera o padrão semanal).
 */
@Entity
@Table(name = "escala_excecao", uniqueConstraints = @UniqueConstraint(columnNames = {"usuario_id", "data"}))
public class EscalaExcecao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false)
    private LocalDate data;

    @Column(nullable = false)
    private boolean trabalha;

    @Column(name = "hora_inicio")
    private LocalTime horaInicio;

    @Column(name = "hora_fim")
    private LocalTime horaFim;

    @Column(length = 200)
    private String observacao;

    protected EscalaExcecao() {
        // JPA
    }

    public EscalaExcecao(
            Usuario usuario, LocalDate data, boolean trabalha, LocalTime horaInicio, LocalTime horaFim, String observacao) {
        validarHorario(trabalha, horaInicio, horaFim);
        this.usuario = usuario;
        this.data = data;
        this.trabalha = trabalha;
        this.horaInicio = horaInicio;
        this.horaFim = horaFim;
        this.observacao = observacao;
    }

    /** Reaproveita a linha existente pra mesma data em vez de apagar e recriar (mantém o id). */
    public void atualizar(boolean trabalha, LocalTime horaInicio, LocalTime horaFim, String observacao) {
        validarHorario(trabalha, horaInicio, horaFim);
        this.trabalha = trabalha;
        this.horaInicio = horaInicio;
        this.horaFim = horaFim;
        this.observacao = observacao;
    }

    private static void validarHorario(boolean trabalha, LocalTime horaInicio, LocalTime horaFim) {
        if (trabalha) {
            if (horaInicio == null || horaFim == null) {
                throw new HorarioInvalidoException("Informe o horário de início e fim pro dia trabalhado");
            }
            if (!horaFim.isAfter(horaInicio)) {
                throw new HorarioInvalidoException("O fim do horário precisa ser depois do início");
            }
        } else if (horaInicio != null || horaFim != null) {
            throw new HorarioInvalidoException("Um dia de folga não deve ter horário");
        }
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public LocalDate getData() {
        return data;
    }

    public boolean isTrabalha() {
        return trabalha;
    }

    public LocalTime getHoraInicio() {
        return horaInicio;
    }

    public LocalTime getHoraFim() {
        return horaFim;
    }

    public String getObservacao() {
        return observacao;
    }
}
