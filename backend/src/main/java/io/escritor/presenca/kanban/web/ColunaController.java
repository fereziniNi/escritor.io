package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.CardService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Criar card é aberto a qualquer usuário autenticado (PRD: "Como usuário, quero criar cards...",
 * sem restrição de papel) - diferente de criar quadro/coluna, que é só GESTOR/ADMIN. Ainda não
 * verifica se o usuário tem acesso ao quadro dono desta coluna (mesma regra de
 * RegraVisibilidadeQuadro) - fica como simplificação conhecida até uma fatia futura de
 * autorização por card.
 */
@RestController
@RequestMapping("/colunas")
public class ColunaController {

    private final CardService cardService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ColunaController(CardService cardService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.cardService = cardService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping("/{id}/cards")
    @ResponseStatus(HttpStatus.CREATED)
    public CardResponse criarCard(@PathVariable Long id, @Valid @RequestBody CriarCardRequest request) {
        return cardService.criar(
                id,
                request.titulo(),
                request.descricao(),
                request.responsavelId(),
                request.prazo(),
                request.estimativaMinutos(),
                contextoUsuarioAutenticado.usuarioAtual());
    }
}
