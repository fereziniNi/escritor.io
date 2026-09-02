package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AtualizarCargaDiariaRequest;
import io.escritor.presenca.identidade.web.CriarUsuarioRequest;
import io.escritor.presenca.identidade.web.UsuarioResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public UsuarioResponse criar(CriarUsuarioRequest request) {
        Usuario usuario = new Usuario(
                request.nome(),
                request.email(),
                request.papel(),
                request.cargaDiariaMinutos());

        Usuario salvo = usuarioRepository.save(usuario);

        return UsuarioResponse.de(salvo);
    }

    /** Tela de admin "gerenciar colaboradores" (pedido do usuário) - lista todo mundo, sem
     * paginação (mesmo padrão simples de {@code ProjetoService.listarVisiveis}, volume esperado é baixo). */
    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAll().stream().map(UsuarioResponse::de).toList();
    }

    /** Único campo editável depois da criação até agora (pedido do usuário: "o admin deve
     * definir [a carga diária] para os outros funcionários, não deve ser padrão") - os demais
     * (nome/email/papel) não têm uma tela de edição ainda, fora de escopo aqui. */
    public UsuarioResponse atualizarCargaDiaria(Long usuarioId, AtualizarCargaDiariaRequest request) {
        Usuario usuario = usuarioRepository
                .findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado"));

        usuario.alterarCargaDiaria(request.cargaDiariaMinutos());
        Usuario salvo = usuarioRepository.save(usuario);

        return UsuarioResponse.de(salvo);
    }
}
