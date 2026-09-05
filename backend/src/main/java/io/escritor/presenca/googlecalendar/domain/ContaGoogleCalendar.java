package io.escritor.presenca.googlecalendar.domain;

import io.escritor.presenca.identidade.domain.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Uma conta Google conectada por usuário (1:1) - pedido do usuário: "algo muito parecido com o
 * agenda do google... ou ate mesmo integrar". {@code refreshToken} é criptografado em repouso
 * ({@link CriptografiaTokenConverter}) porque, diferente de {@code TokenRenovacao} (só hash,
 * comparação própria), esse valor precisa ser reenviado pra Google em texto claro pra renovar o
 * access token quando expira.
 */
@Entity
@Table(name = "conta_google_calendar")
public class ContaGoogleCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false, unique = true)
    private Usuario usuario;

    @Convert(converter = CriptografiaTokenConverter.class)
    @Column(name = "refresh_token", nullable = false, columnDefinition = "text")
    private String refreshToken;

    @Column(name = "calendario_id", nullable = false)
    private String calendarioId;

    @Column(name = "conectado_em", nullable = false)
    private Instant conectadoEm;

    @Column(name = "ultima_sincronizacao_em")
    private Instant ultimaSincronizacaoEm;

    protected ContaGoogleCalendar() {
        // JPA
    }

    public ContaGoogleCalendar(Usuario usuario, String refreshToken, Instant agora) {
        this.usuario = usuario;
        this.refreshToken = refreshToken;
        this.calendarioId = "primary";
        this.conectadoEm = agora;
    }

    /** Google só devolve um refresh token novo na primeira autorização (ou reconsentimento) - usado
     * quando o usuário desconecta e conecta de novo. */
    public void atualizarRefreshToken(String novoRefreshToken) {
        this.refreshToken = novoRefreshToken;
    }

    public void registrarSincronizacao(Instant momento) {
        this.ultimaSincronizacaoEm = momento;
    }

    public Long getId() {
        return id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getCalendarioId() {
        return calendarioId;
    }

    public Instant getConectadoEm() {
        return conectadoEm;
    }

    public Instant getUltimaSincronizacaoEm() {
        return ultimaSincronizacaoEm;
    }
}
