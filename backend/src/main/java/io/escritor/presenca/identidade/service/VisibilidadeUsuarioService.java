package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.MembroEquipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Extraída de {@code ApontamentoService} (S4.10) - até então a única lógica de "gestor vê equipe"
 * do sistema vivia direto dentro de um serviço de outro épico. PRD §2: "gestor vê jornada e
 * relatórios das suas equipes" - E4 (relatórios) precisa da mesma regra em vários lugares, daí a
 * extração antes de duplicar o par de queries em {@link MembroEquipeRepository} em cada serviço
 * novo.
 */
@Service
public class VisibilidadeUsuarioService {

    private final MembroEquipeRepository membroEquipeRepository;

    public VisibilidadeUsuarioService(MembroEquipeRepository membroEquipeRepository) {
        this.membroEquipeRepository = membroEquipeRepository;
    }

    /**
     * Colaborador só vê os próprios dados (checado aqui via id, então funciona mesmo pra quem não
     * é ADMIN/GESTOR); gestor vê qualquer usuário membro de uma equipe que ele lidera
     * (`PapelNaEquipe.LIDER`); admin vê todo mundo, sem checar equipe.
     */
    public boolean podeVer(Usuario requisitante, Usuario alvo) {
        if (requisitante.getId().equals(alvo.getId())) {
            return true;
        }
        if (requisitante.getPapel() == Papel.ADMIN) {
            return true;
        }
        if (requisitante.getPapel() != Papel.GESTOR) {
            return false;
        }

        List<Equipe> equipesLideradas = membroEquipeRepository.findByUsuarioAndPapelNaEquipe(requisitante, PapelNaEquipe.LIDER).stream()
                .map(MembroEquipe::getEquipe)
                .toList();
        return membroEquipeRepository.existsByEquipeInAndUsuario(equipesLideradas, alvo);
    }
}
