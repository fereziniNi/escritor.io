package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.SessaoTrabalhoService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pedido do usuário: widget global (canto superior direito) da tarefa com o cronômetro rodando
 * agora - 200 com o card quando há uma sessão ativa, 204 quando não há. */
@WebMvcTest(CronometroAtivoController.class)
@Import({SecurityConfig.class, JwtService.class})
class CronometroAtivoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessaoTrabalhoService sessaoTrabalhoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/cronometro/ativo")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void comSessaoAtivaRetorna200ComOCard() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.consultarAtivo(null))
                .thenReturn(Optional.of(new CronometroAtivoResponse(10L, "Corrigir bug", 5L, Instant.parse("2026-01-13T11:00:00Z"), 30)));

        mockMvc.perform(get("/cronometro/ativo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cardId").value(10))
                .andExpect(jsonPath("$.cardTitulo").value("Corrigir bug"))
                .andExpect(jsonPath("$.projetoId").value(5))
                .andExpect(jsonPath("$.totalMinutosFechados").value(30));
    }

    @Test
    @WithMockUser
    void semSessaoAtivaRetorna204() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.consultarAtivo(null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/cronometro/ativo")).andExpect(status().isNoContent());
    }
}
