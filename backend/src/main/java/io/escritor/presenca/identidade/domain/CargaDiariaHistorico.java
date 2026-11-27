package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/** Uma mudança de carga diária: {@code minutos} vale a partir de {@code vigenteDesde} (inclusive)
 * até a próxima mudança. Ver {@link Usuario#cargaDiariaEm}. */
@Entity
@Table(name = "carga_diaria_historico")
public class CargaDiariaHistorico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, updatable = false)
    private Usuario usuario;

    @Column(name = "vigente_desde", nullable = false, updatable = false)
    private LocalDate vigenteDesde;

    @Column(nullable = false)
    private int minutos;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected CargaDiariaHistorico() {
        // JPA
    }

    CargaDiariaHistorico(Usuario usuario, LocalDate vigenteDesde, int minutos) {
        this.usuario = usuario;
        this.vigenteDesde = vigenteDesde;
        this.minutos = minutos;
        this.criadoEm = Instant.now();
    }

    public LocalDate getVigenteDesde() {
        return vigenteDesde;
    }

    public int getMinutos() {
        return minutos;
    }

    void alterarMinutos(int novosMinutos) {
        this.minutos = novosMinutos;
    }
}
