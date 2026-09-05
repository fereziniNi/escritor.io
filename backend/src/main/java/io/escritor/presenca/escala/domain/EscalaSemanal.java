package io.escritor.presenca.escala.domain;

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
import jakarta.persistence.UniqueConstraint;
import java.time.DayOfWeek;
import java.time.LocalTime;

/**
 * Padrão semanal recorrente de trabalho - pedido do usuário: "calendário individual... com opção
 * de deixar sempre a configuração". Um dia da semana sem linha aqui significa que o usuário
 * normalmente não trabalha nesse dia (ver V38). {@link EscalaExcecao} é quem cobre uma data
 * específica diferente deste padrão, sem alterá-lo.
 */
@Entity
@Table(name = "escala_semanal", uniqueConstraints = @UniqueConstraint(columnNames = {"usuario_id", "dia_semana"}))
public class EscalaSemanal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "dia_semana", nullable = false)
    private DayOfWeek diaSemana;

    @Column(name = "hora_inicio", nullable = false)
    private LocalTime horaInicio;

    @Column(name = "hora_fim", nullable = false)
    private LocalTime horaFim;

    protected EscalaSemanal() {
        // JPA
    }

    public EscalaSemanal(Usuario usuario, DayOfWeek diaSemana, LocalTime horaInicio, LocalTime horaFim) {
        if (horaInicio == null || horaFim == null || !horaFim.isAfter(horaInicio)) {
            throw new HorarioInvalidoException("O fim do horário precisa ser depois do início");
        }
        this.usuario = usuario;
        this.diaSemana = diaSemana;
        this.horaInicio = horaInicio;
        this.horaFim = horaFim;
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public DayOfWeek getDiaSemana() {
        return diaSemana;
    }

    public LocalTime getHoraInicio() {
        return horaInicio;
    }

    public LocalTime getHoraFim() {
        return horaFim;
    }
}
