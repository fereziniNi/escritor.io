package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.ponto.notificacao.EnvioWhatsApp;
import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import io.escritor.presenca.relatorio.repository.ConfiguracaoRelatorioDiarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento... todo dia
 * na mesma hora ele recebe o documento". Roda a cada minuto (não precisa de mais granularidade -
 * o admin escolhe hora:minuto, não segundos) e compara com o horário configurado, em fuso de
 * Brasil (diferente da fronteira do "dia" em si, que continua UTC - ver {@link
 * RelatorioDiarioService}). Sem `zone` no cron: "a cada minuto" é a mesma coisa em qualquer fuso,
 * só a COMPARAÇÃO com o horário configurado precisa considerar o fuso certo, o que já é feito
 * manualmente aqui.
 *
 * <p>{@code ultimoEnvioEm} (persistido em {@link ConfiguracaoRelatorioDiario}) evita mandar duas
 * vezes no mesmo dia - importante porque "a cada minuto" pode coincidir com o horário configurado
 * mais de uma vez só se o relógio andar pra trás (não deveria, mas é uma rede de segurança barata)
 * ou se o método demorar e dois disparos se sobrepuserem.
 */
@Component
public class EnvioRelatorioDiarioScheduler {

    private static final Logger log = LoggerFactory.getLogger(EnvioRelatorioDiarioScheduler.class);
    private static final ZoneId FUSO_BRASIL = ZoneId.of("America/Sao_Paulo");

    private final ConfiguracaoRelatorioDiarioRepository configuracaoRepository;
    private final RelatorioDiarioService relatorioDiarioService;
    private final EnvioWhatsApp envioWhatsApp;
    private final Clock clock;

    public EnvioRelatorioDiarioScheduler(
            ConfiguracaoRelatorioDiarioRepository configuracaoRepository,
            RelatorioDiarioService relatorioDiarioService,
            EnvioWhatsApp envioWhatsApp,
            Clock clock) {
        this.configuracaoRepository = configuracaoRepository;
        this.relatorioDiarioService = relatorioDiarioService;
        this.envioWhatsApp = envioWhatsApp;
        this.clock = clock;
    }

    @Scheduled(cron = "0 * * * * *")
    public void verificarEEnviarSeForAHora() {
        ConfiguracaoRelatorioDiario configuracao =
                configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO).orElse(null);
        if (configuracao == null || !configuracao.isHabilitado()) {
            return;
        }

        ZonedDateTime agoraNoBrasil = Instant.now(clock).atZone(FUSO_BRASIL);
        LocalTime agoraHoraMinuto = LocalTime.of(agoraNoBrasil.getHour(), agoraNoBrasil.getMinute());
        if (!agoraHoraMinuto.equals(configuracao.getHorarioEnvio())) {
            return;
        }
        if (jaEnviouHoje(configuracao, agoraNoBrasil)) {
            return;
        }

        log.info("Enviando o resumo diário pro chefe (horário configurado: {})", configuracao.getHorarioEnvio());
        envioWhatsApp.enviarParaChefe(relatorioDiarioService.montarResumoDoDia(configuracao.getPreferencias()));
        configuracao.registrarEnvio(Instant.now(clock));
        configuracaoRepository.save(configuracao);
    }

    private boolean jaEnviouHoje(ConfiguracaoRelatorioDiario configuracao, ZonedDateTime agoraNoBrasil) {
        Instant ultimoEnvio = configuracao.getUltimoEnvioEm();
        return ultimoEnvio != null && ultimoEnvio.atZone(FUSO_BRASIL).toLocalDate().equals(agoraNoBrasil.toLocalDate());
    }
}
