package io.escritor.presenca.notificacao.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Histórico pessoal de notificações (pedido do usuário: "ver as últimas que chegaram no
 * sistema") - sem filtro de papel, cada um só vê o próprio ({@code destinatario} é sempre quem
 * está autenticado). */
@RestController
public class NotificacaoController {

    private final NotificacaoService notificacaoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public NotificacaoController(NotificacaoService notificacaoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.notificacaoService = notificacaoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/notificacoes")
    public NotificacoesResponse listar() {
        return notificacaoService.listarMinhas(contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/notificacoes/marcar-lidas")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marcarLidas() {
        notificacaoService.marcarTodasComoLidas(contextoUsuarioAutenticado.usuarioAtual());
    }
}
