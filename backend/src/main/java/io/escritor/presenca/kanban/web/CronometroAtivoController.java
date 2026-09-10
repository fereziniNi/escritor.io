package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.SessaoTrabalhoService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Pedido do usuário: "o cronometro deve estar... no canto superior direito... se eu clicar nele
 * abre o modal dessa atividade" - widget global, fora do board Kanban, então fica num controller
 * próprio em vez de {@link SessaoTrabalhoController} (que é sempre escopado a um {@code {id}} de
 * card). 200 com o corpo quando há um cronômetro rodando, 204 sem corpo quando não há - evita
 * inventar um campo {@code ativo: false} a mais no contrato. */
@RestController
public class CronometroAtivoController {

    private final SessaoTrabalhoService sessaoTrabalhoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public CronometroAtivoController(SessaoTrabalhoService sessaoTrabalhoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.sessaoTrabalhoService = sessaoTrabalhoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/cronometro/ativo")
    public ResponseEntity<CronometroAtivoResponse> consultarAtivo() {
        return sessaoTrabalhoService
                .consultarAtivo(contextoUsuarioAutenticado.usuarioAtual())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
