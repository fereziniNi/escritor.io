package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.service.SolicitacaoAjusteService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SolicitacaoAjusteController.class)
@Import({SecurityConfig.class, JwtService.class})
class SolicitacaoAjusteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SolicitacaoAjusteService solicitacaoAjusteService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/ajustes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA","momento":"2026-01-15T09:00:00Z","justificativa":"Esqueci"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void solicitacaoValidaRetorna201() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(solicitacaoAjusteService.solicitar(any(), eq(TipoRegistroPonto.ENTRADA), any(), eq(null), eq("Esqueci")))
                .thenReturn(new SolicitacaoAjusteResponse(
                        1L,
                        TipoRegistroPonto.ENTRADA,
                        Instant.parse("2026-01-15T09:00:00Z"),
                        null,
                        "Esqueci",
                        StatusSolicitacaoAjuste.PENDENTE));

        mockMvc.perform(post("/ajustes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA","momento":"2026-01-15T09:00:00Z","justificativa":"Esqueci"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.registroAlvoId").doesNotExist());
    }

    @Test
    @WithMockUser
    void solicitacaoComRegistroAlvoRepassaOId() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(solicitacaoAjusteService.solicitar(any(), eq(TipoRegistroPonto.ENTRADA), any(), eq(10L), eq("Bati errado")))
                .thenReturn(new SolicitacaoAjusteResponse(
                        2L,
                        TipoRegistroPonto.ENTRADA,
                        Instant.parse("2026-01-15T09:10:00Z"),
                        10L,
                        "Bati errado",
                        StatusSolicitacaoAjuste.PENDENTE));

        mockMvc.perform(post("/ajustes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA","momento":"2026-01-15T09:10:00Z","registroAlvoId":10,"justificativa":"Bati errado"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.registroAlvoId").value(10));
    }

    @Test
    @WithMockUser
    void semJustificativaRetorna400() throws Exception {
        mockMvc.perform(post("/ajustes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA","momento":"2026-01-15T09:00:00Z","justificativa":"   "}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void semTipoRetorna400() throws Exception {
        mockMvc.perform(post("/ajustes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"momento":"2026-01-15T09:00:00Z","justificativa":"Esqueci"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
