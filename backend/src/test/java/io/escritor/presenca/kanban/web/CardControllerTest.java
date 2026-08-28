package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroQuadroException;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.service.CardService;
import io.escritor.presenca.kanban.service.EtiquetaService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CardController.class)
@Import({SecurityConfig.class, JwtService.class})
class CardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CardService cardService;

    @MockitoBean
    private EtiquetaService etiquetaService;

    @Test
    void moverSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(patch("/cards/1/mover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"colunaId":2,"indice":0}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeMoverCard() throws Exception {
        when(cardService.mover(eq(1L), eq(2L), eq(0)))
                .thenReturn(new CardResponse(
                        1L, 2L, "Corrigir bug", null, 1024.0, null, null, null, 1L, Instant.now(), false, java.util.List.of()));

        mockMvc.perform(patch("/cards/1/mover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"colunaId":2,"indice":0}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.colunaId").value(2));
    }

    @Test
    @WithMockUser
    void moverCardInexistenteRetorna404() throws Exception {
        when(cardService.mover(eq(999L), eq(2L), eq(0))).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(patch("/cards/999/mover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"colunaId":2,"indice":0}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void moverParaColunaNoLimiteWipRetorna409() throws Exception {
        when(cardService.mover(eq(1L), eq(2L), eq(0))).thenThrow(new LimiteWipExcedidoException(2L, 3));

        mockMvc.perform(patch("/cards/1/mover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"colunaId":2,"indice":0}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    @WithMockUser
    void moverSemColunaIdRetorna400() throws Exception {
        mockMvc.perform(patch("/cards/1/mover")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"indice":0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aplicarEtiquetaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/etiquetas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etiquetaId":2}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeAplicarEtiqueta() throws Exception {
        when(etiquetaService.aplicar(1L, 2L)).thenReturn(new EtiquetaResponse(2L, 9L, "Urgente", "#FF0000"));

        mockMvc.perform(post("/cards/1/etiquetas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etiquetaId":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Urgente"));
    }

    @Test
    @WithMockUser
    void aplicarEtiquetaDeOutroQuadroRetorna400() throws Exception {
        when(etiquetaService.aplicar(1L, 2L)).thenThrow(new EtiquetaDeOutroQuadroException(2L, 1L));

        mockMvc.perform(post("/cards/1/etiquetas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"etiquetaId":2}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void aplicarEtiquetaSemEtiquetaIdRetorna400() throws Exception {
        mockMvc.perform(post("/cards/1/etiquetas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void removerEtiquetaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(delete("/cards/1/etiquetas/2")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeRemoverEtiqueta() throws Exception {
        mockMvc.perform(delete("/cards/1/etiquetas/2")).andExpect(status().isNoContent());

        verify(etiquetaService).remover(1L, 2L);
    }
}
