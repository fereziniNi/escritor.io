package io.escritor.presenca.infra;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    /**
     * Fuso da empresa: define "que dia é" pra jornada, espelho, fechamento e relatórios (quem lê
     * usa `clock.getZone()`). Antes era UTC - às 21h de Brasília o dia virava, o cronômetro de
     * quem ainda estava trabalhando zerava e uma jornada que passava das 21h ficava partida em dois
     * dias (ENTRADA num, SAIDA no outro, os dois inconsistentes). Instantes continuam UTC no banco.
     */
    public static final ZoneId FUSO_EMPRESA = ZoneId.of("America/Sao_Paulo");

    @Bean
    Clock clock() {
        return Clock.system(FUSO_EMPRESA);
    }
}
