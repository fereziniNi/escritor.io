package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import jakarta.validation.constraints.NotNull;

/**
 * Só o tipo da marcação - de propósito não tem campo de momento nenhum. O horário é sempre o do
 * relógio do servidor (PRD E1); se o cliente mandar um campo "momento" no corpo, ele é
 * silenciosamente ignorado (Jackson não falha em propriedade desconhecida por padrão no Boot).
 */
public record MarcarPontoRequest(@NotNull TipoRegistroPonto tipo) {
}
