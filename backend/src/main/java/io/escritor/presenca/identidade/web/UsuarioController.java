package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.UsuarioService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Só ADMIN em todos os endpoints (inclusive listar) - tela de "gerenciar colaboradores" é
 * administrativa, expõe carga diária/papel de todo mundo (pedido do usuário: "o admin deve
 * definir [a carga diária] pros outros funcionários"). */
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UsuarioResponse criar(@Valid @RequestBody CriarUsuarioRequest request) {
        return usuarioService.criar(request);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<UsuarioResponse> listar() {
        return usuarioService.listar();
    }

    @PatchMapping("/{id}/carga-diaria")
    @PreAuthorize("hasRole('ADMIN')")
    public UsuarioResponse atualizarCargaDiaria(@PathVariable Long id, @Valid @RequestBody AtualizarCargaDiariaRequest request) {
        return usuarioService.atualizarCargaDiaria(id, request);
    }
}
