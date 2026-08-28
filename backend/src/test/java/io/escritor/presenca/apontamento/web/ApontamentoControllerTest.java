package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.ApontamentoJaEncerradoException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.apontamento.service.ApontamentoService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ApontamentoController.class)
@Import({SecurityConfig.class, JwtService.class})
class ApontamentoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ApontamentoService apontamentoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void iniciarTimerSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/apontamentos/timer")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeIniciarTimer() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.iniciarTimer(eq(1L), any()))
                .thenReturn(new ApontamentoResponse(
                        10L, 2L, 1L, Instant.parse("2026-01-15T12:00:00Z"), null, null, null, "TIMER",
                        Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T12:00:00Z")));

        mockMvc.perform(post("/cards/1/apontamentos/timer"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cardId").value(1))
                .andExpect(jsonPath("$.origem").value("TIMER"))
                .andExpect(jsonPath("$.fim").doesNotExist());
    }

    @Test
    @WithMockUser
    void iniciarTimerEmCardInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.iniciarTimer(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/cards/999/apontamentos/timer")).andExpect(status().isNotFound());
    }

    @Test
    void pararSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(patch("/apontamentos/1/parar")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void usuarioAutenticadoParaOProprioTimer() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.parar(eq(1L), any()))
                .thenReturn(new ApontamentoResponse(
                        1L, 2L, 5L, Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T12:30:00Z"), 30, null,
                        "TIMER", Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T12:30:00Z")));

        mockMvc.perform(patch("/apontamentos/1/parar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minutos").value(30))
                .andExpect(jsonPath("$.fim").exists());
    }

    @Test
    @WithMockUser
    void pararApontamentoDeOutroUsuarioRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.parar(eq(1L), any())).thenThrow(new ApontamentoDeOutroUsuarioException());

        mockMvc.perform(patch("/apontamentos/1/parar")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void pararApontamentoJaEncerradoRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.parar(eq(1L), any())).thenThrow(new ApontamentoJaEncerradoException());

        mockMvc.perform(patch("/apontamentos/1/parar")).andExpect(status().isConflict());
    }

    @Test
    @WithMockUser
    void pararApontamentoInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.parar(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(patch("/apontamentos/999/parar")).andExpect(status().isNotFound());
    }

    @Test
    void criarManualSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/apontamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeLancarManualComMinutos() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.criarManual(eq(1L), any(), any(), eq(120), eq("Pareamento"), any()))
                .thenReturn(new ApontamentoResponse(
                        1L, 2L, 1L, Instant.parse("2026-01-15T10:00:00Z"), Instant.parse("2026-01-15T12:00:00Z"), 120,
                        "Pareamento", "MANUAL", Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T12:00:00Z")));

        mockMvc.perform(post("/cards/1/apontamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"minutos":120,"descricao":"Pareamento"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.minutos").value(120))
                .andExpect(jsonPath("$.origem").value("MANUAL"));
    }

    @Test
    @WithMockUser
    void criarManualComMinutosEIntervaloRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.criarManual(eq(1L), any(), any(), any(), any(), any()))
                .thenThrow(new LancamentoManualInvalidoException("ambíguo"));

        mockMvc.perform(post("/cards/1/apontamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inicio":"2026-01-15T10:00:00Z","fim":"2026-01-15T12:00:00Z","minutos":120}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void criarManualEmCardInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.criarManual(eq(999L), any(), any(), any(), any(), any()))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/cards/999/apontamentos")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"minutos":60}
                                """))
                .andExpect(status().isNotFound());
    }
}
