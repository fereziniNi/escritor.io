package io.escritor.presenca.reuniao.web;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.reuniao.service.ReuniaoService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aninhado sob {@code /escala} de propósito (`@RequestMapping("/escala/reunioes")`) - não precisa
 * de entrada nova no allowlist de proxy do nginx/Vite. Pedido do usuário: "onde o usuário do
 * sistema (independente) vai conseguir marcar e entrar nas reuniões do meet" - criar/cancelar
 * deixou de ser GESTOR/ADMIN só (era assim antes desta reunião ganhar Meet): agora é qualquer
 * usuário autenticado, restrito apenas por ter (ou não) conectado a própria conta Google
 * ({@code ReuniaoService} valida isso). {@code /equipe} continua GESTOR/ADMIN-only - visão de
 * todo mundo, não uma ação de criar.
 */
@RestController
@RequestMapping("/escala/reunioes")
public class ReuniaoController {

    private final ReuniaoService reuniaoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ReuniaoController(ReuniaoService reuniaoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.reuniaoService = reuniaoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReuniaoResponse criar(@Valid @RequestBody CriarReuniaoRequest request) {
        Usuario criador = contextoUsuarioAutenticado.usuarioAtual();
        return reuniaoService.criar(criador, request);
    }

    @GetMapping
    public List<ReuniaoResponse> listarMinhas(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return reuniaoService.listarMinhas(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }

    @GetMapping("/equipe")
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public List<ReuniaoResponse> listarDaEquipe(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return reuniaoService.listarDaEquipe(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remover(@PathVariable Long id) {
        reuniaoService.remover(contextoUsuarioAutenticado.usuarioAtual(), id);
    }
}
