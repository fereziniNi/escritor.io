package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import java.time.LocalTime;

/** {@code configurado=false} (com {@code horarioEnvio}/{@code habilitado} em valores neutros)
 * significa que nenhum admin escolheu um horário ainda - diferente de {@code habilitado=false}
 * (já configurado, mas pausado de propósito). */
public record ConfiguracaoRelatorioDiarioResponse(boolean configurado, LocalTime horarioEnvio, boolean habilitado) {

    public static ConfiguracaoRelatorioDiarioResponse de(ConfiguracaoRelatorioDiario configuracao) {
        if (configuracao == null) {
            return new ConfiguracaoRelatorioDiarioResponse(false, null, false);
        }
        return new ConfiguracaoRelatorioDiarioResponse(true, configuracao.getHorarioEnvio(), configuracao.isHabilitado());
    }
}
