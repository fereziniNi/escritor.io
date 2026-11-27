package io.escritor.presenca.kanban.domain;

/** O projeto do card não tem uma coluna que represente o estado pedido (ex.: só 2 colunas, sem "Em andamento"). */
public class EstadoTarefaIndisponivelException extends RuntimeException {

    public EstadoTarefaIndisponivelException(String nomeDaEtapa) {
        super("Este projeto não tem a etapa '" + nomeDaEtapa + "'");
    }
}
