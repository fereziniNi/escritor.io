package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.CardComentarioService;
import io.escritor.presenca.kanban.service.CardEventoService;
import io.escritor.presenca.kanban.service.CardService;
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

/**
 * Mover é aberto a qualquer usuário autenticado, mesma simplificação conhecida de criar card
 * (ColunaController, S3.6) - ainda não verifica acesso ao projeto dono do card (mover precisa de
 * {@link ContextoUsuarioAutenticado} mesmo assim, desde S3.17, só pra registrar quem fez a
 * mudança de coluna no histórico). Comentar (S3.15) e ler o histórico (S3.17) exigem acesso ao
 * projeto (403 sem ele).
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
