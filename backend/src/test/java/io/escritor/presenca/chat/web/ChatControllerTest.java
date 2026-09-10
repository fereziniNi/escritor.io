package io.escritor.presenca.chat.web;

import io.escritor.presenca.chat.domain.AcessoNegadoAConversaException;
import io.escritor.presenca.chat.domain.ConversaInvalidaException;
import io.escritor.presenca.chat.domain.TipoConversa;
import io.escritor.presenca.chat.service.ChatService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pedido do usuário: "funcionários poderem conversar e o chefe conversar com os funcionários,
 * além de ter um grupo geral" - sem `@PreAuthorize` nenhum no controller, então nenhum teste aqui
 * precisa provar 403 por papel (diferente de `ReuniaoControllerTest#equipeComPapelColaboradorRetorna403`,
 * que existe porque `/equipe` É restrito).
 */
@WebMvcTest(ChatController.class)
@Import({SecurityConfig.class, JwtService.class})
class ChatControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ChatService chatService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void listarConversasSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/chat/conversas")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorListaAsPropriasConversas() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.listarMinhasConversas(any()))
                .thenReturn(List.of(new ConversaResponse(1L, TipoConversa.GERAL, "Geral", null, 3L)));

        mockMvc.perform(get("/chat/conversas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Geral"))
                .andExpect(jsonPath("$[0].naoLidas").value(3));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorAbreConversaDiretaComQualquerOutraPessoa() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.abrirConversaDireta(any(), anyLong()))
                .thenReturn(new ConversaResponse(5L, TipoConversa.DIRETA, "Beto Lima", null, 0L));

        mockMvc.perform(post("/chat/conversas/diretas/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Beto Lima"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void abrirConversaConsigoMesmoRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.abrirConversaDireta(any(), anyLong())).thenThrow(new ConversaInvalidaException("Não pode"));

        mockMvc.perform(post("/chat/conversas/diretas/1")).andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void chefeConsegueMandarMensagemPraUmFuncionario() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.enviar(any(), anyLong(), any()))
                .thenReturn(new MensagemResponse(10L, 5L, 1L, "Chefe", "Bom dia, equipe!", Instant.parse("2026-01-15T09:00:00Z")));

        mockMvc.perform(post("/chat/conversas/5/mensagens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Bom dia, equipe!"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.texto").value("Bom dia, equipe!"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void enviarComTextoVazioRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(post("/chat/conversas/5/mensagens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void enviarSemParticiparDaConversaRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.enviar(any(), anyLong(), any())).thenThrow(new AcessoNegadoAConversaException("Não participa"));

        mockMvc.perform(post("/chat/conversas/5/mensagens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Oi"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorListaMensagensDeUmaConversa() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(chatService.listarMensagens(any(), anyLong())).thenReturn(List.of());

        mockMvc.perform(get("/chat/conversas/5/mensagens")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorMarcaUmaConversaComoLida() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(post("/chat/conversas/5/lida")).andExpect(status().isNoContent());
    }
}
