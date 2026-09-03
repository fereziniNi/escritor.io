package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
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

/** ADMIN em todos os endpoints que expõem dado sensível (papel/carga diária/email) ou permitem
 * criar/editar - tela de "gerenciar colaboradores" é administrativa (pedido do usuário: "o admin
 * deve definir [a carga diária] pros outros funcionários"). {@link #listarBasico} é a exceção
 * deliberada: id+nome só, aberto a qualquer autenticado, pra alimentar autocomplete de "escolher
 * uma pessoa" em qualquer lugar do sistema (pedido do cliente: nome em vez de id, com sugestão
 * das pessoas cadastradas). {@link #meuUsuario}/{@link #atualizarMinhaAparencia} são a outra
 * exceção: self-service, qualquer autenticado só sobre o próprio usuário (via {@code
 * ContextoUsuarioAutenticado}, não `{id}`), pedido do usuário "a opção para todos detalhar da
 * melhor maneira possível o avatar". */
@RestController
@RequestMapping("/usuarios")
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public UsuarioController(UsuarioService usuarioService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.usuarioService = usuarioService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
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

    @GetMapping("/basico")
    public List<UsuarioBasicoResponse> listarBasico() {
        return usuarioService.listarBasico();
    }

    @PatchMapping("/{id}/carga-diaria")
    @PreAuthorize("hasRole('ADMIN')")
    public UsuarioResponse atualizarCargaDiaria(@PathVariable Long id, @Valid @RequestBody AtualizarCargaDiariaRequest request) {
        return usuarioService.atualizarCargaDiaria(id, request);
    }

    @GetMapping("/me")
    public UsuarioResponse meuUsuario() {
        return usuarioService.buscarMeuUsuario(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PatchMapping("/me/aparencia")
    public UsuarioResponse atualizarMinhaAparencia(@Valid @RequestBody AtualizarPersonagemRequest request) {
        return usuarioService.atualizarMeuPersonagem(contextoUsuarioAutenticado.usuarioAtual(), request);
    }
}
