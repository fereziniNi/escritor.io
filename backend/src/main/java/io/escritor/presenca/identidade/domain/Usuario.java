package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Papel papel;

    @Column(name = "carga_diaria_minutos", nullable = false)
    private Integer cargaDiariaMinutos;

    @Column(nullable = false)
    private boolean ativo;

    @Embedded
    private AparenciaAvatar aparencia;

    /** Pedido do usuário: avisar por WhatsApp quando o usuário finaliza uma tarefa (dono/criador do
     * card) ou recebe uma mensagem de chat, além do aviso já existente na tela - diferente do
     * "chefe" ({@code app.evolution.chefe-numero}, um número fixo só pra avisos de ponto), este é
     * o WhatsApp de CADA colaborador. Opcional de propósito (sem {@code nullable = false}): quem
     * não tiver preenchido simplesmente não recebe aviso por WhatsApp (ver {@code
     * EnvioWhatsApp#enviar}, que já ignora número em branco). Só ADMIN cadastra/edita - ver
     * {@link #alterarWhatsapp}. */
    @Column
    private String whatsapp;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Usuario() {
        // JPA
    }

    public Usuario(String nome, String email, Papel papel, Integer cargaDiariaMinutos) {
        this.nome = nome;
        this.email = email;
        this.papel = papel;
        this.cargaDiariaMinutos = cargaDiariaMinutos;
        this.ativo = true;
        this.aparencia = AparenciaAvatar.padrao();
        this.criadoEm = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getEmail() {
        return email;
    }

    public Papel getPapel() {
        return papel;
    }

    public Integer getCargaDiariaMinutos() {
        return cargaDiariaMinutos;
    }

    /** Pedido do usuário: "o admin deve definir [a carga diária] para os outros funcionários, não
     * deve ser padrão" - antes só dava pra escolher na criação, sem jeito nenhum de mudar depois.
     * Validação de positivo fica só na camada web ({@code @Positive} em
     * {@code AtualizarCargaDiariaRequest}), mesmo padrão já usado no construtor deste tipo. */
    public void alterarCargaDiaria(Integer novaCargaDiariaMinutos) {
        this.cargaDiariaMinutos = novaCargaDiariaMinutos;
    }

    /** Pedido do usuário: "edição de perfil. Nome e email nesse modal" - self-service (mesmo
     * espírito de {@link #alterarAparencia}), diferente de {@link #alterarCargaDiaria}
     * (ADMIN-only). A checagem de e-mail duplicado já rodou antes de chegar aqui, em {@code
     * UsuarioService} - este método só troca os valores. */
    public void alterarPerfil(String novoNome, String novoEmail) {
        this.nome = novoNome;
        this.email = novoEmail;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public AparenciaAvatar getAparencia() {
        return aparencia;
    }

    /** Pedido do usuário: "a opção para todos detalhar da melhor maneira possível o avatar" -
     * self-service (qualquer usuário troca a própria aparência, ver {@code PATCH
     * /usuarios/me/aparencia}), diferente de {@link #alterarCargaDiaria} (ADMIN-only). A validação
     * de paleta de cor ({@link PaletaAparenciaAvatar#validar}) já rodou antes de chegar aqui, em
     * {@code UsuarioService} - este método só troca o valor. */
    public void alterarAparencia(AparenciaAvatar novaAparencia) {
        this.aparencia = novaAparencia;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    /** ADMIN-only (mesmo espírito de {@link #alterarCargaDiaria}) - {@code novoWhatsapp} em branco
     * ou {@code null} desliga o aviso por WhatsApp pra este usuário (volta a só receber a
     * notificação na tela). Formato (só dígitos, código do país + DDD + número) validado na camada
     * web, mesmo padrão de sempre neste tipo. */
    public void alterarWhatsapp(String novoWhatsapp) {
        this.whatsapp = (novoWhatsapp == null || novoWhatsapp.isBlank()) ? null : novoWhatsapp;
    }
}
