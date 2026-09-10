package io.escritor.presenca.reuniao.domain;

import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema (independente) vai conseguir marcar e entrar nas reuniões do meet... deixar
 * disponível para entrar na reunião com quem ele quer dos funcionários" - evolução do que já
 * existia (chefe marcava com um funcionário só, sem Meet): agora qualquer usuário pode ser
 * {@link #criador}, com um ou mais {@link #participantes}, e a reunião carrega um {@link
 * #linkMeet} de verdade (preenchido depois, quando a Google responde à criação do evento - ela é
 * quem gera o link). A validação de "dentro do expediente efetivo de cada participante" e "sem
 * sobreposição" continua no {@code ReuniaoService} (depende de {@code EscalaService}, que este
 * pacote não pode reimplementar aqui).
 */
@Entity
@Table(name = "reuniao")
public class Reuniao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "criador_id", nullable = false)
    private Usuario criador;

    @OneToMany(mappedBy = "reuniao", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReuniaoParticipante> participantes = new ArrayList<>();

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "hora_inicio", nullable = false)
    private LocalTime horaInicio;

    @Column(name = "hora_fim", nullable = false)
    private LocalTime horaFim;

    @Column(nullable = false, length = 200)
    private String titulo;

    /** Nulo até a Google responder à criação do evento (é ela quem gera o link, via
     * {@code conferenceData.createRequest} - ver {@code GoogleMeetService}). */
    @Column(name = "link_meet", length = 500)
    private String linkMeet;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    protected Reuniao() {
        // JPA
    }

    public Reuniao(Usuario criador, List<Usuario> participantes, LocalDate data, LocalTime horaInicio, LocalTime horaFim,
            String titulo, Instant criadoEm) {
        if (!horaFim.isAfter(horaInicio)) {
            throw new HorarioInvalidoException("O fim da reunião precisa ser depois do início");
        }
        this.criador = criador;
        this.data = data;
        this.horaInicio = horaInicio;
        this.horaFim = horaFim;
        this.titulo = titulo;
        this.criadoEm = criadoEm;
        this.participantes = participantes.stream().map(usuario -> new ReuniaoParticipante(this, usuario)).toList();
    }

    public Long getId() {
        return id;
    }

    public Usuario getCriador() {
        return criador;
    }

    public List<ReuniaoParticipante> getParticipantes() {
        return participantes;
    }

    public LocalDate getData() {
        return data;
    }

    public LocalTime getHoraInicio() {
        return horaInicio;
    }

    public LocalTime getHoraFim() {
        return horaFim;
    }

    public String getTitulo() {
        return titulo;
    }

    public String getLinkMeet() {
        return linkMeet;
    }

    /** Pedido do usuário: "disponibilizar o link caso queira compartilhar com outras pessoas" -
     * setado uma única vez, logo após a Google confirmar a criação do evento com Meet
     * ({@code ReuniaoService#criar}). */
    public void definirLinkMeet(String linkMeet) {
        this.linkMeet = linkMeet;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }
}
