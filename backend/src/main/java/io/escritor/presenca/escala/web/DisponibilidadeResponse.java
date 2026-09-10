package io.escritor.presenca.escala.web;

import java.time.LocalTime;

/**
 * Pedido do usuário: "Não consegui marcar a reunião!!" - investigando, o motivo mais comum é
 * tentar marcar num horário/dia que o convidado simplesmente não trabalha, e o único jeito de
 * descobrir isso hoje era tentar salvar e receber um 400 genérico (sem corpo, convenção do
 * projeto - ver {@code TratamentoErroGlobal}). Este DTO existe pra {@code
 * MarcarReuniaoComMeetModal} conseguir mostrar, antes de enviar, se cada participante escolhido
 * está disponível na data escolhida - mesmo cálculo de {@code EscalaService#calcularEfetiva}, só
 * que devolvido por pessoa em vez de por dia.
 */
public record DisponibilidadeResponse(Long usuarioId, String nome, boolean trabalha, LocalTime horaInicio, LocalTime horaFim) {
}
