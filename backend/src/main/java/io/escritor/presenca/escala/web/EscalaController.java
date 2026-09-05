package io.escritor.presenca.escala.web;

import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.googlecalendar.service.GoogleCalendarSincronizacaoService;
import io.escritor.presenca.identidade.domain.Usuario;
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
 *
 * <p>Toda mutação também dispara {@link GoogleCalendarSincronizacaoService#sincronizarSeConectado}
 * (assíncrono, não atrasa a resposta) - pedido do usuário: "algo muito parecido com o agenda do
 * google... ou ate mesmo integrar". Fica aqui no controller, não dentro de {@code EscalaService},
 * porque o serviço de sincronização já depende de {@code EscalaService} pra ler a escala efetiva -
 * injetar de volta criaria uma dependência circular entre os dois.
 */
@RestController
@RequestMapping("/escala")
public class EscalaController {

    private final EscalaService escalaService;
    private final GoogleCalendarSincronizacaoService googleSincronizacaoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public EscalaController(
            EscalaService escalaService,
            GoogleCalendarSincronizacaoService googleSincronizacaoService,
            ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.escalaService = escalaService;
        this.googleSincronizacaoService = googleSincronizacaoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/semanal")
    public List<EscalaSemanalResponse> listarSemanal() {
        return escalaService.listarSemanal(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PutMapping("/semanal")
    public List<EscalaSemanalResponse> definirSemanal(@Valid @RequestBody List<ItemEscalaSemanalRequest> itens) {
        Usuario usuario = contextoUsuarioAutenticado.usuarioAtual();
        List<EscalaSemanalResponse> resultado = escalaService.definirSemanal(usuario, itens);
        googleSincronizacaoService.sincronizarSeConectado(usuario);
        return resultado;
    }

    @GetMapping("/excecoes")
    public List<EscalaExcecaoResponse> listarExcecoes(@RequestParam LocalDate inicio, @RequestParam LocalDate fim) {
        return escalaService.listarExcecoes(contextoUsuarioAutenticado.usuarioAtual(), inicio, fim);
    }

    @PostMapping("/excecoes")
    @ResponseStatus(HttpStatus.CREATED)
    public EscalaExcecaoResponse salvarExcecao(@Valid @RequestBody SalvarExcecaoRequest request) {
        Usuario usuario = contextoUsuarioAutenticado.usuarioAtual();
        EscalaExcecaoResponse resultado = escalaService.salvarExcecao(usuario, request);
        googleSincronizacaoService.sincronizarSeConectado(usuario);
        return resultado;
    }

    @DeleteMapping("/excecoes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removerExcecao(@PathVariable Long id) {
        Usuario usuario = contextoUsuarioAutenticado.usuarioAtual();
        escalaService.removerExcecao(usuario, id);
        googleSincronizacaoService.sincronizarSeConectado(usuario);
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
