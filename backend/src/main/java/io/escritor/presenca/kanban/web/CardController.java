package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.CardComentarioService;
import io.escritor.presenca.kanban.service.CardEventoService;
import io.escritor.presenca.kanban.service.CardService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mover, comentar, ler o histórico, atualizar e excluir exigem acesso ao projeto dono do card
 * (403 sem ele, {@code CardService#verificarAcesso}) - aberto a qualquer membro, sem restringir
 * por cargo ou por quem criou o card (pedido do usuário: "qualquer pessoa com acesso ao
 * projeto"). Excluir é permanente (pedido do usuário: "apagar de verdade") - comentários/
 * histórico/sessões de trabalho do card são apagados junto, em cascata no banco (migração V53),
 * não ficam órfãos.
 */
@RestController
@RequestMapping("/cards")
public class CardController {

    private final CardService cardService;
    private final CardComentarioService cardComentarioService;
    private final CardEventoService cardEventoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public CardController(
            CardService cardService,
            CardComentarioService cardComentarioService,
            CardEventoService cardEventoService,
            ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.cardService = cardService;
        this.cardComentarioService = cardComentarioService;
        this.cardEventoService = cardEventoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PatchMapping("/{id}/mover")
    public CardResponse mover(@PathVariable Long id, @Valid @RequestBody MoverCardRequest request) {
        return cardService.mover(id, request.colunaId(), request.indice(), contextoUsuarioAutenticado.usuarioAtual());
    }

    @PatchMapping("/{id}")
    public CardResponse atualizar(@PathVariable Long id, @Valid @RequestBody AtualizarCardRequest request) {
        return cardService.atualizar(
                id,
                request.titulo(),
                request.descricao(),
                request.responsavelId(),
                request.prazo(),
                request.estimativaMinutos(),
                contextoUsuarioAutenticado.usuarioAtual());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluir(@PathVariable Long id) {
        cardService.excluir(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/{id}/comentarios")
    @ResponseStatus(HttpStatus.CREATED)
    public CardComentarioResponse criarComentario(@PathVariable Long id, @Valid @RequestBody CriarComentarioRequest request) {
        return cardComentarioService.criar(id, request.texto(), contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/{id}/comentarios")
    public List<CardComentarioResponse> listarComentarios(@PathVariable Long id) {
        return cardComentarioService.listar(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/{id}/eventos")
    public List<CardEventoResponse> listarEventos(@PathVariable Long id) {
        return cardEventoService.listar(id, contextoUsuarioAutenticado.usuarioAtual());
    }
}
