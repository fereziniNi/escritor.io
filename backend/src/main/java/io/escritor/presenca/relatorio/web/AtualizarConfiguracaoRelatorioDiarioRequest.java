package io.escritor.presenca.relatorio.web;

import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

public record AtualizarConfiguracaoRelatorioDiarioRequest(@NotNull LocalTime horarioEnvio, boolean habilitado) {
}
