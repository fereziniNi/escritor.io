package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.service.ApontamentoService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sem `@RequestMapping` de classe de propósito: este controller vai crescer pra cobrir tanto
 * criação aninhada em card (`/cards/{id}/apontamentos*`, S4.2/S4.5) quanto operações diretas por
 * id do próprio apontamento (`/apontamentos/{id}*`, S4.3/S4.6) - duas raízes, não uma.
 */
@RestController
public class ApontamentoController {

    private final ApontamentoService apontamentoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ApontamentoController(ApontamentoService apontamentoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.apontamentoService = apontamentoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping("/cards/{id}/apontamentos/timer")
    @ResponseStatus(HttpStatus.CREATED)
    public ApontamentoResponse iniciarTimer(@PathVariable Long id) {
        return apontamentoService.iniciarTimer(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PatchMapping("/apontamentos/{id}/parar")
    public ApontamentoResponse parar(@PathVariable Long id) {
        return apontamentoService.parar(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/cards/{id}/apontamentos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApontamentoResponse criarManual(@PathVariable Long id, @Valid @RequestBody CriarApontamentoManualRequest request) {
        return apontamentoService.criarManual(
                id, request.inicio(), request.fim(), request.minutos(), request.descricao(), contextoUsuarioAutenticado.usuarioAtual());
    }

    @PatchMapping("/apontamentos/{id}")
    public ApontamentoResponse editar(@PathVariable Long id, @RequestBody EditarApontamentoRequest request) {
        return apontamentoService.editar(
                id, request.inicio(), request.fim(), request.descricao(), contextoUsuarioAutenticado.usuarioAtual());
    }

    @DeleteMapping("/apontamentos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        apontamentoService.excluir(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/cards/{id}/apontamentos")
    public List<ApontamentoResponse> listarPorCard(@PathVariable Long id) {
        return apontamentoService.listarPorCard(id);
    }

    @GetMapping("/apontamentos")
    public List<ApontamentoResponse> listarPorUsuarioEPeriodo(
            @RequestParam(required = false) Long usuarioId, @RequestParam Instant inicio, @RequestParam Instant fim) {
        return apontamentoService.listarPorUsuarioEPeriodo(usuarioId, inicio, fim, contextoUsuarioAutenticado.usuarioAtual());
    }
}
