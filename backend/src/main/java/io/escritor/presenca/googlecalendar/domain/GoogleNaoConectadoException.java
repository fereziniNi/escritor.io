package io.escritor.presenca.googlecalendar.domain;

/** Pedido do usuário: "onde o usuário do sistema... vai conseguir marcar e entrar nas reuniões do
 * meet" - só é possível gerar um link de Meet de verdade no calendário de quem cria a reunião, e
 * isso exige uma conta Google conectada (é a Google quem gera o link, via {@code
 * conferenceData.createRequest}). Diferente de {@link GoogleIntegracaoDesabilitadaException}
 * (ninguém pode usar isso NESTE ambiente, faltam credenciais do app) - aqui o app está habilitado,
 * só essa pessoa específica ainda não conectou a própria conta. */
public class GoogleNaoConectadoException extends RuntimeException {

    public GoogleNaoConectadoException() {
        super("Conecte sua conta do Google Agenda antes de marcar uma reunião com Meet");
    }
}
