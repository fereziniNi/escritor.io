package io.escritor.presenca.relatorio.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalTime;

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento sobre o que
 * foi feito no dia pelos funcionarios... todo dia na mesma hora". Linha única (id sempre 1, ver
 * migração V29) - só existe um "chefe" configurado no sistema (mesma decisão já tomada pra
 * {@code EVOLUTION_CHEFE_NUMERO}), então uma configuração global é suficiente, sem precisar de
 * uma linha por admin.
 *
 * <p>Pedido do usuário (V47): "adicionar mais informações no relatório diário, mas deixe
 * personalizado para o admin" - os seis campos {@code incluir*} (agrupados como {@link
 * PreferenciasConteudoRelatorioDiario} fora da entidade) escolhem quais blocos entram no resumo
 * ({@code RelatorioDiarioService}); os dois primeiros nasceram `true` na migração pra preservar o
 * comportamento de quem já tinha configurado antes desta personalização existir.
 */
@Entity
@Table(name = "configuracao_relatorio_diario")
public class ConfiguracaoRelatorioDiario {

    /** Sempre 1 - singleton reforçado por CHECK no banco (V29), não por lógica de aplicação. */
    public static final Long ID_UNICO = 1L;

    @Id
    private Long id;

    @Column(name = "horario_envio", nullable = false)
    private LocalTime horarioEnvio;

    @Column(nullable = false)
    private boolean habilitado;

    @Column(name = "incluir_ponto", nullable = false)
    private boolean incluirPonto;

    @Column(name = "incluir_tarefas_criadas_movidas", nullable = false)
    private boolean incluirTarefasCriadasMovidas;

    @Column(name = "incluir_tarefas_concluidas", nullable = false)
    private boolean incluirTarefasConcluidas;

    @Column(name = "incluir_reunioes", nullable = false)
    private boolean incluirReunioes;

    @Column(name = "incluir_ausencias", nullable = false)
    private boolean incluirAusencias;

    @Column(name = "incluir_resumo_equipe", nullable = false)
    private boolean incluirResumoEquipe;

    @Column(name = "ultimo_envio_em")
    private Instant ultimoEnvioEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected ConfiguracaoRelatorioDiario() {
        // JPA
    }

    public ConfiguracaoRelatorioDiario(
            LocalTime horarioEnvio, boolean habilitado, PreferenciasConteudoRelatorioDiario preferencias, Instant agora) {
        this.id = ID_UNICO;
        this.horarioEnvio = horarioEnvio;
        this.habilitado = habilitado;
        aplicarPreferencias(preferencias);
        this.atualizadoEm = agora;
    }

    public void atualizar(LocalTime horarioEnvio, boolean habilitado, PreferenciasConteudoRelatorioDiario preferencias, Instant agora) {
        this.horarioEnvio = horarioEnvio;
        this.habilitado = habilitado;
        aplicarPreferencias(preferencias);
        this.atualizadoEm = agora;
    }

    private void aplicarPreferencias(PreferenciasConteudoRelatorioDiario preferencias) {
        this.incluirPonto = preferencias.ponto();
        this.incluirTarefasCriadasMovidas = preferencias.tarefasCriadasMovidas();
        this.incluirTarefasConcluidas = preferencias.tarefasConcluidas();
        this.incluirReunioes = preferencias.reunioes();
        this.incluirAusencias = preferencias.ausencias();
        this.incluirResumoEquipe = preferencias.resumoEquipe();
    }

    public PreferenciasConteudoRelatorioDiario getPreferencias() {
        return new PreferenciasConteudoRelatorioDiario(
                incluirPonto, incluirTarefasCriadasMovidas, incluirTarefasConcluidas, incluirReunioes, incluirAusencias,
                incluirResumoEquipe);
    }

    /**
     * Marca que o resumo já saiu hoje - o agendador ({@code EnvioRelatorioDiarioScheduler}) usa
     * isso pra nunca mandar duas vezes no mesmo dia, mesmo rodando a cada minuto (ex.: se o
     * backend reiniciar bem no minuto configurado, ou o relógio do container atrasar/adiantar).
     */
    public void registrarEnvio(Instant momento) {
        this.ultimoEnvioEm = momento;
    }

    public Long getId() {
        return id;
    }

    public LocalTime getHorarioEnvio() {
        return horarioEnvio;
    }

    public boolean isHabilitado() {
        return habilitado;
    }

    public Instant getUltimoEnvioEm() {
        return ultimoEnvioEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }
}
