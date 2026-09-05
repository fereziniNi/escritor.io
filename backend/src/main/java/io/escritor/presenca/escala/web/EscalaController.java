package io.escritor.presenca.escala.web;

import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do usuário: "calendário individual para indicar os dias que ira trabalhar... Para que o
 * admin/chefe conseguir ver os momentos em que os funcionários estarão trabalhando". Todo endpoint
 * de leitura/escrita da própria escala ({@code /semanal}, {@code /excecoes}, {@code /efetiva}) atua
 * sempre sobre o usuário autenticado, sem parâmetro {@code usuarioId} - ninguém edita a escala de
 * outra pessoa, nem ADMIN. Só {@code /equipe} é GESTOR/ADMIN, e é somente leitura.
 */
@RestController
@RequestMapping("/escala")
public class EscalaController {

    private final EscalaService escalaService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public EscalaController(EscalaService escalaService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.escalaService = escalaService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/semanal")
    public List<EscalaSemanalResponse> listarSemanal() {
        return escalaService.listarSemanal(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PutMapping("/semanal")
    public List<EscalaSemanalResponse> definirSemanal(@Valid @RequestBody List<ItemEscalaSemanalRequest> itens) {
        return escalaService.definirSemanal(contextoUsuarioAutenticado.usuarioAtual(), itens);
    }

    @GetMapping("/excecoes")
    public List<EscalaExcecaoResponse> listarExcecoes(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return escalaService.listarExcecoes(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }

    @PostMapping("/excecoes")
    @ResponseStatus(HttpStatus.CREATED)
    public EscalaExcecaoResponse salvarExcecao(@Valid @RequestBody SalvarExcecaoRequest request) {
        return escalaService.salvarExcecao(contextoUsuarioAutenticado.usuarioAtual(), request);
    }

    @DeleteMapping("/excecoes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerExcecao(@PathVariable Long id) {
        escalaService.removerExcecao(contextoUsuarioAutenticado.usuarioAtual(), id);
    }

    @GetMapping("/efetiva")
    public List<DiaEfetivoResponse> efetiva(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return escalaService.calcularEfetiva(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }

    @GetMapping("/equipe")
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public List<EscalaEquipeResponse> equipe(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return escalaService.calcularEfetivaDaEquipe(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }
}
