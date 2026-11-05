package io.escritor.presenca.skills.domain;

/**
 * Pacote de skill inválido (slug, caminhos, tamanhos ou frontmatter). A mensagem é em português e
 * pode ser exibida diretamente ao usuário no editor.
 */
public class SkillInvalidaException extends RuntimeException {

    public SkillInvalidaException(String mensagem) {
        super(mensagem);
    }
}
