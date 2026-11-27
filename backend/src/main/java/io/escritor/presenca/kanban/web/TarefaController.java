package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.TarefaService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** "Minhas tarefas": aberto a qualquer usuário autenticado; as regras ficam em {@link TarefaService}. */
@RestController
@RequestMapping("/tarefas")
public class TarefaController {

    private final TarefaService tarefaService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public TarefaController(TarefaService tarefaService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.tarefaService = tarefaService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/minhas")
    public List<TarefaResponse> minhas() {
        return tarefaService.listarMinhas(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TarefaResponse criar(@Valid @RequestBody CriarTarefaRequest request) {
        return tarefaService.criar(
                contextoUsuarioAutenticado.usuarioAtual(),
                request.titulo(),
                request.projetoId(),
                request.prazo(),
                request.estimativaMinutos());
    }

    @PatchMapping("/{cardId}/estado")
    public TarefaResponse mudarEstado(@PathVariable Long cardId, @Valid @RequestBody MudarEstadoTarefaRequest request) {
        return tarefaService.mudarEstado(cardId, request.estado(), contextoUsuarioAutenticado.usuarioAtual());
    }
}
