package io.escritor.presenca.kanban.domain;

import java.util.Set;

/**
 * PRD §2: o usuário enxerga quadros das equipes das quais é membro, mais quadros dos projetos aos
 * quais essas equipes estão vinculadas. Recebe ids soltos (não a entidade {@code Quadro}) pelo
 * mesmo motivo de {@code Marcacao} desacoplar de {@code RegistroPonto}: testável sem JPA.
 */
public final class RegraVisibilidadeQuadro {

    private RegraVisibilidadeQuadro() {
    }

    public static boolean visivel(
            Long quadroEquipeId, Long quadroProjetoId, Set<Long> equipeIdsDoUsuario, Set<Long> projetoIdsVisiveis) {
        boolean visivelPelaEquipe = quadroEquipeId != null && equipeIdsDoUsuario.contains(quadroEquipeId);
        boolean visivelPeloProjeto = quadroProjetoId != null && projetoIdsVisiveis.contains(quadroProjetoId);
        return visivelPelaEquipe || visivelPeloProjeto;
    }
}
