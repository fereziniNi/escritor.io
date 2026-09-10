package io.escritor.presenca.identidade.domain;

/** Pedido do usuário: "edição de perfil. Nome e email" - self-service (`PATCH /usuarios/me/perfil`),
 * então precisa validar duplicidade de e-mail aqui (diferente de {@link
 * io.escritor.presenca.identidade.web.CriarUsuarioRequest}, ADMIN-only e improvável de colidir por
 * acidente - aqui é a própria pessoa digitando um e-mail à mão, mais fácil de repetir o de outro
 * colega sem querer). */
public class EmailJaCadastradoException extends RuntimeException {

    public EmailJaCadastradoException(String mensagem) {
        super(mensagem);
    }
}
