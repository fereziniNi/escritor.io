package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.relatorio.domain.PreferenciasConteudoRelatorioDiario;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

/**
 * Os seis campos {@code incluir*} espelham {@link PreferenciasConteudoRelatorioDiario} - soltos
 * aqui (não aninhados) porque é assim que o formulário HTML de checkboxes manda mais naturalmente,
 * sem precisar de um objeto agrupador no corpo do request.
 */
public record AtualizarConfiguracaoRelatorioDiarioRequest(
        @NotNull LocalTime horarioEnvio,
        boolean habilitado,
        boolean incluirPonto,
        boolean incluirTarefasCriadasMovidas,
        boolean incluirTarefasConcluidas,
        boolean incluirReunioes,
        boolean incluirAusencias,
        boolean incluirResumoEquipe) {

    public PreferenciasConteudoRelatorioDiario preferencias() {
        return new PreferenciasConteudoRelatorioDiario(
                incluirPonto, incluirTarefasCriadasMovidas, incluirTarefasConcluidas, incluirReunioes, incluirAusencias,
                incluirResumoEquipe);
    }
}
