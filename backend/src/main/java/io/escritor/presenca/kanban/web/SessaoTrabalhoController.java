package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.SessaoTrabalhoService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Pedido do usuário: "um contador de tempo onde a pessoa inicia, pausa e finaliza" - aberto a
 * qualquer usuário autenticado, mesma simplificação já usada por {@code CardController}/
 * {@code ColunaController} (sem checar responsável/projeto do card). */
@RestController
@RequestMapping("/cards/{id}/cronometro")
public class SessaoTrabalhoController {

    private final SessaoTrabalhoService sessaoTrabalhoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public SessaoTrabalhoController(SessaoTrabalhoService sessaoTrabalhoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.sessaoTrabalhoService = sessaoTrabalhoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping
    public CronometroResponse consultar(@PathVariable Long id) {
        return sessaoTrabalhoService.consultar(id);
    }

    @PostMapping("/iniciar")
    public CronometroResponse iniciar(@PathVariable Long id) {
        return sessaoTrabalhoService.iniciar(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/pausar")
    public CronometroResponse pausar(@PathVariable Long id) {
        return sessaoTrabalhoService.pausar(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/finalizar")
    public CronometroResponse finalizar(@PathVariable Long id, @Valid @RequestBody FinalizarTarefaRequest request) {
        return sessaoTrabalhoService.finalizar(id, request.descricao(), contextoUsuarioAutenticado.usuarioAtual());
    }
}
