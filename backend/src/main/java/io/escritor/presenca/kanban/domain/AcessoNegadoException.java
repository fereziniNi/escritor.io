package io.escritor.presenca.kanban.domain;

/**
 * Diferente de {@link io.escritor.presenca.identidade.service.RecursoNaoEncontradoException}
 * (usada em {@code ProjetoService.buscarDetalhe} pra não revelar que um projeto não visível
 * existe), comentário exige 403 explícito pelo enunciado do PRD (S3.15) - o card em si não é o
 * recurso sensível aqui, só a ação de comentar nele sem acesso ao projeto.
 */
public class AcessoNegadoException extends RuntimeException {

    public AcessoNegadoException(String mensagem) {
        super(mensagem);
    }
}
