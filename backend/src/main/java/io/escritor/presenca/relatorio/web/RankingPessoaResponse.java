package io.escritor.presenca.relatorio.web;

/** Uma linha de um ranking de equipe (horas trabalhadas, tarefas concluídas ou reuniões) -
 * {@code valor} muda de sentido conforme o ranking, mas o formato é sempre o mesmo. */
public record RankingPessoaResponse(Long usuarioId, String nome, long valor) {
}
