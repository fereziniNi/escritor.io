package io.escritor.presenca.identidade.domain;

import java.util.Set;

/**
 * Pedido do cliente (via usuário): sem quadro separado - o usuário enxerga um projeto se foi
 * atribuído a ele diretamente ({@link MembroProjeto}), ponto. Recebe o id solto (não a entidade
 * {@code Projeto}) pelo mesmo motivo de {@code Marcacao} desacoplar de {@code RegistroPonto}:
 * testável sem JPA.
 */
public final class RegraVisibilidadeProjeto {

    private RegraVisibilidadeProjeto() {
    }

    public static boolean visivel(Long projetoId, Set<Long> projetoIdsDoUsuario) {
        return projetoIdsDoUsuario.contains(projetoId);
    }
}
