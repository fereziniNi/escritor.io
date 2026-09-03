package io.escritor.presenca.relatorio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.escritor.presenca.ponto.notificacao.EnvioWhatsApp;
import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import io.escritor.presenca.relatorio.repository.ConfiguracaoRelatorioDiarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Pedido do cliente: "todo dia na mesma hora ele recebe o documento". `Clock` fixo simula o
 * agendador disparando exatamente no minuto configurado, sem precisar esperar um minuto de
 * verdade passar - o `@Scheduled(cron = "0 * * * * *")` em si (a cadência de "todo minuto") é
 * infraestrutura do Spring, não testada aqui; o que importa é a decisão de enviar ou não.
 */
@ExtendWith(MockitoExtension.class)
class EnvioRelatorioDiarioSchedulerTest {

    // 21:00 UTC = 18:00 em America/Sao_Paulo (UTC-3, sem horário de verão).
    private static final Instant AS_18H_NO_BRASIL = Instant.parse("2026-01-15T21:00:00Z");

    @Mock
    private ConfiguracaoRelatorioDiarioRepository configuracaoRepository;

    @Mock
    private RelatorioDiarioService relatorioDiarioService;

    @Mock
    private EnvioWhatsApp envioWhatsApp;

    private EnvioRelatorioDiarioScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new EnvioRelatorioDiarioScheduler(
                configuracaoRepository, relatorioDiarioService, envioWhatsApp, Clock.fixed(AS_18H_NO_BRASIL, ZoneOffset.UTC));
    }

    private static ConfiguracaoRelatorioDiario configuracao(LocalTime horario, boolean habilitado, Instant ultimoEnvio) {
        ConfiguracaoRelatorioDiario configuracao = new ConfiguracaoRelatorioDiario(horario, habilitado, Instant.EPOCH);
        if (ultimoEnvio != null) {
            configuracao.registrarEnvio(ultimoEnvio);
        }
        return configuracao;
    }

    @Test
    void envolveOResumoQuandoBateOHorarioConfigurado() {
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO))
                .thenReturn(Optional.of(configuracao(LocalTime.of(18, 0), true, null)));
        when(relatorioDiarioService.montarResumoDoDia()).thenReturn("resumo do dia")
                ;

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp).enviarParaChefe("resumo do dia");
    }

    @Test
    void naoEnviaQuandoAindaNaoEHoraConfigurada() {
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO))
                .thenReturn(Optional.of(configuracao(LocalTime.of(19, 0), true, null)));

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp, never()).enviarParaChefe(any());
    }

    @Test
    void naoEnviaQuandoDesabilitadoMesmoNoHorarioCerto() {
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO))
                .thenReturn(Optional.of(configuracao(LocalTime.of(18, 0), false, null)));

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp, never()).enviarParaChefe(any());
    }

    @Test
    void naoEnviaQuandoNenhumAdminConfigurouAinda() {
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO)).thenReturn(Optional.empty());

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp, never()).enviarParaChefe(any());
    }

    @Test
    void naoEnviaDeNovoSeJaEnviouHojeMesmoNoMinutoCerto() {
        // Simula o agendador rodando de novo no mesmo minuto (ex.: reinício do backend) - o envio
        // de "hoje" já registrado não pode virar um segundo disparo.
        Instant maisCedoHoje = AS_18H_NO_BRASIL.minusSeconds(60);
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO))
                .thenReturn(Optional.of(configuracao(LocalTime.of(18, 0), true, maisCedoHoje)));

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp, never()).enviarParaChefe(any());
    }

    @Test
    void enviaDeNovoNoDiaSeguinteMesmoComUltimoEnvioRegistrado() {
        Instant ontemNoMesmoHorario = AS_18H_NO_BRASIL.minus(java.time.Duration.ofDays(1));
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO))
                .thenReturn(Optional.of(configuracao(LocalTime.of(18, 0), true, ontemNoMesmoHorario)));
        when(relatorioDiarioService.montarResumoDoDia()).thenReturn("resumo do dia");

        scheduler.verificarEEnviarSeForAHora();

        verify(envioWhatsApp).enviarParaChefe("resumo do dia");
    }

    @Test
    void registraOMomentoDoEnvioParaEvitarDuplicar() {
        ConfiguracaoRelatorioDiario configuracao = configuracao(LocalTime.of(18, 0), true, null);
        when(configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO)).thenReturn(Optional.of(configuracao));
        when(relatorioDiarioService.montarResumoDoDia()).thenReturn("resumo do dia");

        scheduler.verificarEEnviarSeForAHora();

        ArgumentCaptor<ConfiguracaoRelatorioDiario> captor = ArgumentCaptor.forClass(ConfiguracaoRelatorioDiario.class);
        verify(configuracaoRepository).save(captor.capture());
        assertThat(captor.getValue().getUltimoEnvioEm()).isEqualTo(AS_18H_NO_BRASIL);
    }
}
