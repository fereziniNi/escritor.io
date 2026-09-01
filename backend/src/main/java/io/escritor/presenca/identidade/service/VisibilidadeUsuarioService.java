package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.MembroQuadro;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.MembroQuadroRepository;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/**
 * Extraída de {@code ApontamentoService} (S4.10) - até então a única lógica de "gestor vê equipe"
 * do sistema vivia direto dentro de um serviço de outro épico. Pedido do cliente (via usuário):
 * sem Equipe - GESTOR passa a ver quem está atribuído aos mesmos quadros/"sistemas" que ele
 * ({@link MembroQuadro}), no lugar de "membro de uma equipe que ele lidera".
 */
@Service
public class VisibilidadeUsuarioService {

    private final MembroQuadroRepository membroQuadroRepository;
    private final UsuarioRepository usuarioRepository;

    public VisibilidadeUsuarioService(MembroQuadroRepository membroQuadroRepository, UsuarioRepository usuarioRepository) {
        this.membroQuadroRepository = membroQuadroRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * Colaborador só vê os próprios dados (checado aqui via id, então funciona mesmo pra quem não
     * é ADMIN/GESTOR); gestor vê qualquer usuário atribuído a um quadro do qual ele também é
     * membro (sem distinção de "líder" - a atribuição em si já é a regra); admin vê todo mundo,
     * sem checar quadro nenhum.
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

        List<Quadro> quadrosDoRequisitante = membroQuadroRepository.findByUsuario(requisitante).stream()
                .map(MembroQuadro::getQuadro)
                .toList();
        return membroQuadroRepository.existsByQuadroInAndUsuario(quadrosDoRequisitante, alvo);
    }

    /**
     * Resolve o "usuário alvo" de um filtro opcional por id (padrão desde S4.10, reusado por todo
     * endpoint de E4 que aceita `usuarioId`): nulo, ou igual ao do próprio requisitante, é sempre
     * "eu mesmo" e nem toca {@link UsuarioRepository}; outro id só resolve se {@link #podeVer}
     * autorizar. A exceção de "acesso negado" é fornecida por quem chama, não fixa aqui, porque
     * cada contexto tem a sua própria (`ApontamentoDeOutroUsuarioException`, `JornadaDeOutroUsuarioException`
     * etc.) - {@link #podeVer} é a regra compartilhada, a exceção continua sendo do domínio de
     * cada épico.
     */
    public Usuario resolverAlvo(Long usuarioIdFiltro, Usuario usuarioAutenticado, Supplier<? extends RuntimeException> excecaoDeAcessoNegado) {
        if (usuarioIdFiltro == null || usuarioIdFiltro.equals(usuarioAutenticado.getId())) {
            return usuarioAutenticado;
        }

        Usuario usuarioAlvo = usuarioRepository
                .findById(usuarioIdFiltro)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + usuarioIdFiltro));

        if (!podeVer(usuarioAutenticado, usuarioAlvo)) {
            throw excecaoDeAcessoNegado.get();
        }

        return usuarioAlvo;
    }
}
