package io.escritor.presenca.happyhour.web;

import io.escritor.presenca.happyhour.service.HappyHourService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Pedido do usuário: mural do Happy Hour (sugerir atividades + roleta) - aberto a qualquer
 * usuário autenticado, mesma simplificação já usada por {@code CardController}/
 * {@code SessaoTrabalhoController} (sem checar papel). */
@RestController
@RequestMapping("/happy-hour")
public class HappyHourController {

    private final HappyHourService happyHourService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public HappyHourController(HappyHourService happyHourService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.happyHourService = happyHourService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/atividades")
    public List<AtividadeResponse> listar() {
        return happyHourService.listar();
    }

    @PostMapping("/atividades")
    @ResponseStatus(HttpStatus.CREATED)
    public AtividadeResponse sugerir(@Valid @RequestBody SugerirAtividadeRequest request) {
        return happyHourService.sugerir(request.descricao(), contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/sortear")
    public AtividadeResponse sortear() {
        return happyHourService.sortear(contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/sorteio")
    public ResponseEntity<AtividadeResponse> sorteioAtual() {
        return happyHourService.sorteioAtual().map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }
}
