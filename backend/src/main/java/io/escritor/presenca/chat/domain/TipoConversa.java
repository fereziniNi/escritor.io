package io.escritor.presenca.chat.domain;

/** DIRETA: exatamente 2 participantes (DM entre dois usuários quaisquer - colegas ou chefe e
 * funcionário, sem distinção). GERAL: uma única linha fixa (ver {@code V44__create_chat.sql}) -
 * "o grupo geral com todos os funcionários" do pedido do usuário; todo mundo entra sob demanda. */
public enum TipoConversa {
    DIRETA,
    GERAL,
}
