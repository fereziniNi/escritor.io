package io.escritor.presenca.skills.domain;

/** Operação em conflito com o estado atual do catálogo (slug repetido, proposta pendente de outra
 * pessoa, versão que não está mais pendente). Vira 409 com a mensagem exibida ao usuário. */
public class ConflitoSkillException extends RuntimeException {

    public ConflitoSkillException(String mensagem) {
        super(mensagem);
    }
}
