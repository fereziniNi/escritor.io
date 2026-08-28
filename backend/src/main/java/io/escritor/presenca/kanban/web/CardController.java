package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.service.CardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mover é aberto a qualquer usuário autenticado, mesma simplificação conhecida de criar card
 * (ColunaController, S3.6) - ainda não verifica acesso ao quadro dono do card.
 */
@RestController
@RequestMapping("/cards")
public class CardController {

    private final CardService cardService;

    public CardController(CardService cardService) {
        this.cardService = cardService;
    }

    @PatchMapping("/{id}/mover")
    public CardResponse mover(@PathVariable Long id, @Valid @RequestBody MoverCardRequest request) {
        return cardService.mover(id, request.colunaId(), request.indice());
    }
}
