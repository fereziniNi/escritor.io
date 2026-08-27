package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.QuadroService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/quadros")
public class QuadroController {

    private final QuadroService quadroService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public QuadroController(QuadroService quadroService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.quadroService = quadroService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping
    public List<QuadroResponse> listar() {
        return quadroService.listarVisiveis(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public QuadroResponse criar(@Valid @RequestBody CriarQuadroRequest request) {
        return quadroService.criar(request.nome(), request.projetoId(), request.equipeId());
    }
}
