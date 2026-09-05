package io.escritor.presenca.escala.web;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Um dia já mesclado (padrão semanal + exceção pontual, ver {@code EscalaService#calcularEfetiva})
 * - sem `id`, porque não corresponde necessariamente a uma linha do banco: pode vir de
 * {@code EscalaSemanal}, de {@code EscalaExcecao}, ou de nenhum dos dois ({@code trabalha=false}).
 */
public record DiaEfetivoResponse(LocalDate data, boolean trabalha, LocalTime horaInicio, LocalTime horaFim) {
}
