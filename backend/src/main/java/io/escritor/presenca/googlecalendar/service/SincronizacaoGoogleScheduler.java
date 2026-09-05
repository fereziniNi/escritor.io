package io.escritor.presenca.googlecalendar.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * A sincronização de {@link GoogleCalendarSincronizacaoService} normalmente é disparada só quando
 * o próprio usuário muda a escala - mas a janela sincronizada é sempre "hoje + 60 dias", que
 * desliza sozinha com o tempo. Sem esse agendador, alguém que conecta a conta e nunca mais toca na
 * escala acabaria com a janela do Google Agenda "acabando" 60 dias depois, mesmo continuando a
 * trabalhar no mesmo padrão semanal de sempre. Roda uma vez por dia, de madrugada (fora do
 * horário comercial), pra manter a janela sempre à frente - mesmo espírito de
 * {@code EnvioRelatorioDiarioScheduler}, só que sem horário configurável (não é algo que o usuário
 * escolhe, é manutenção interna).
 */
@Component
public class SincronizacaoGoogleScheduler {

    private static final Logger log = LoggerFactory.getLogger(SincronizacaoGoogleScheduler.class);

    private final GoogleCalendarSincronizacaoService sincronizacaoService;

    public SincronizacaoGoogleScheduler(GoogleCalendarSincronizacaoService sincronizacaoService) {
        this.sincronizacaoService = sincronizacaoService;
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void sincronizarTodosOsConectados() {
        log.info("Sincronizando a escala de todos os usuários conectados ao Google Agenda");
        sincronizacaoService.sincronizarTodosOsConectados();
    }
}
