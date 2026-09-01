package io.escritor.presenca.kanban.domain;

import java.util.Set;

/**
 * Pedido do cliente (via usuário): sem Equipe - o usuário enxerga um quadro se foi atribuído a
 * ele diretamente ({@link MembroQuadro}), ponto. Recebe o id solto (não a entidade {@code Quadro})
 * pelo mesmo motivo de {@code Marcacao} desacoplar de {@code RegistroPonto}: testável sem JPA.
 */
public final class RegraVisibilidadeQuadro {

    private RegraVisibilidadeQuadro() {
    }

    public static boolean visivel(Long quadroId, Set<Long> quadroIdsDoUsuario) {
        return quadroIdsDoUsuario.contains(quadroId);
    }
}
