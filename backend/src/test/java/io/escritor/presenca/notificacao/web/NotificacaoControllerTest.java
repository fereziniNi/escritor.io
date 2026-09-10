package io.escritor.presenca.notificacao.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pedido do usuário: "ver as últimas que chegaram no sistema" - sem `@PreAuthorize`, é o
 * histórico da própria pessoa (sempre `contextoUsuarioAutenticado.usuarioAtual()`), qualquer
 * papel autenticado acessa o próprio. */
@WebMvcTest(NotificacaoController.class)
@Import({SecurityConfig.class, JwtService.class})
class NotificacaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NotificacaoService notificacaoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void listarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/notificacoes")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listarDevolveOHistoricoEAContagemDeNaoLidas() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(notificacaoService.listarMinhas(null)).thenReturn(new NotificacoesResponse(
                List.of(new NotificacaoResponse(1L, TipoNotificacao.NOVA_TAREFA, "Ana criou a tarefa \"Corrigir bug\"", null, false,
                        Instant.parse("2026-01-15T12:00:00Z"))),
                1L));

        mockMvc.perform(get("/notificacoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.naoLidas").value(1))
                .andExpect(jsonPath("$.itens[0].tipo").value("NOVA_TAREFA"))
                .andExpect(jsonPath("$.itens[0].texto").value("Ana criou a tarefa \"Corrigir bug\""))
                .andExpect(jsonPath("$.itens[0].lida").value(false));
    }

    @Test
    void marcarLidasSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/notificacoes/marcar-lidas")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void marcarLidasChamaOServicoComOUsuarioAutenticado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(post("/notificacoes/marcar-lidas")).andExpect(status().isNoContent());

        verify(notificacaoService).marcarTodasComoLidas(null);
    }
}
