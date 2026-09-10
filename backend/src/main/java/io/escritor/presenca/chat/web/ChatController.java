package io.escritor.presenca.chat.web;

import io.escritor.presenca.chat.service.ChatService;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do usuário: "chat no sistema para os funcionários poderem conversar e o chefe conversar
 * com os funcionários, além de ter um grupo geral com todos os funcionários" - sem {@code
 * @PreAuthorize} em lugar nenhum aqui: qualquer autenticado pode iniciar uma conversa direta com
 * qualquer outro (colega ou chefe, mesma ação) e postar na Geral, mesma filosofia de {@code
 * GET /usuarios/basico} e do agendamento de reunião (épico anterior).
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatService chatService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ChatController(ChatService chatService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.chatService = chatService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/conversas")
    public List<ConversaResponse> listarConversas() {
        return chatService.listarMinhasConversas(contextoUsuarioAutenticado.usuarioAtual());
    }

    /** Get-or-create - chamar de novo com o mesmo colega devolve a mesma conversa, nunca duplica. */
    @PostMapping("/conversas/diretas/{usuarioId}")
    public ConversaResponse abrirConversaDireta(@PathVariable Long usuarioId) {
        return chatService.abrirConversaDireta(contextoUsuarioAutenticado.usuarioAtual(), usuarioId);
    }

    @GetMapping("/conversas/{conversaId}/mensagens")
    public List<MensagemResponse> listarMensagens(@PathVariable Long conversaId) {
        return chatService.listarMensagens(contextoUsuarioAutenticado.usuarioAtual(), conversaId);
    }

    @PostMapping("/conversas/{conversaId}/mensagens")
    @ResponseStatus(HttpStatus.CREATED)
    public MensagemResponse enviar(@PathVariable Long conversaId, @Valid @RequestBody EnviarMensagemRequest request) {
        return chatService.enviar(contextoUsuarioAutenticado.usuarioAtual(), conversaId, request);
    }

    @PostMapping("/conversas/{conversaId}/lida")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marcarComoLida(@PathVariable Long conversaId) {
        chatService.marcarComoLida(contextoUsuarioAutenticado.usuarioAtual(), conversaId);
    }
}
