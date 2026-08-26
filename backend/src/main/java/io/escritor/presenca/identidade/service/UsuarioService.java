package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.CriarUsuarioRequest;
import io.escritor.presenca.identidade.web.UsuarioResponse;
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
}
