package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import io.escritor.presenca.relatorio.domain.PreferenciasConteudoRelatorioDiario;
import java.time.LocalTime;

/** {@code configurado=false} (com {@code horarioEnvio}/{@code habilitado} em valores neutros)
 * significa que nenhum admin escolheu um horário ainda - diferente de {@code habilitado=false}
 * (já configurado, mas pausado de propósito). {@code preferencias} vem em
 * {@link PreferenciasConteudoRelatorioDiario#padrao()} nesse caso, pra tela já nascer com os
 * checkboxes de sempre (ponto + tarefas) marcados antes do primeiro salvamento. */
public record ConfiguracaoRelatorioDiarioResponse(
        boolean configurado, LocalTime horarioEnvio, boolean habilitado, PreferenciasConteudoRelatorioDiario preferencias) {

    public static ConfiguracaoRelatorioDiarioResponse de(ConfiguracaoRelatorioDiario configuracao) {
        if (configuracao == null) {
            return new ConfiguracaoRelatorioDiarioResponse(false, null, false, PreferenciasConteudoRelatorioDiario.padrao());
        }
        return new ConfiguracaoRelatorioDiarioResponse(
                true, configuracao.getHorarioEnvio(), configuracao.isHabilitado(), configuracao.getPreferencias());
    }
}
