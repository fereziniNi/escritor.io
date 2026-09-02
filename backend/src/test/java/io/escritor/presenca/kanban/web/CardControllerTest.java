package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.EtiquetaDeOutroProjetoException;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.service.CardComentarioService;
import io.escritor.presenca.kanban.service.CardEventoService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @MockitoBean
    private CardComentarioService cardComentarioService;

    @MockitoBean
    private CardEventoService cardEventoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

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
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.mover(eq(1L), eq(2L), eq(0), any()))
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
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.mover(eq(999L), eq(2L), eq(0), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

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
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.mover(eq(1L), eq(2L), eq(0), any())).thenThrow(new LimiteWipExcedidoException(2L, 3));

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
    void aplicarEtiquetaDeOutroProjetoRetorna400() throws Exception {
        when(etiquetaService.aplicar(1L, 2L)).thenThrow(new EtiquetaDeOutroProjetoException(2L, 1L));

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

    @Test
    void criarComentarioSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/comentarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Já revisei"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void criaComentarioQuandoTemAcesso() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardComentarioService.criar(eq(1L), eq("Já revisei"), any()))
                .thenReturn(new CardComentarioResponse(1L, 1L, 2L, "Já revisei", Instant.now()));

        mockMvc.perform(post("/cards/1/comentarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Já revisei"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.texto").value("Já revisei"));
    }

    @Test
    @WithMockUser
    void criarComentarioSemAcessoAoProjetoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardComentarioService.criar(eq(1L), eq("Já revisei"), any()))
                .thenThrow(new AcessoNegadoException("sem acesso"));

        mockMvc.perform(post("/cards/1/comentarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Já revisei"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void criarComentarioEmCardInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardComentarioService.criar(eq(999L), eq("Já revisei"), any()))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/cards/999/comentarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"texto":"Já revisei"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void criarComentarioSemTextoRetorna400() throws Exception {
        mockMvc.perform(post("/cards/1/comentarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listarComentariosSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/cards/1/comentarios")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaComentariosQuandoTemAcesso() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardComentarioService.listar(eq(1L), any()))
                .thenReturn(java.util.List.of(new CardComentarioResponse(1L, 1L, 2L, "Já revisei", Instant.now())));

        mockMvc.perform(get("/cards/1/comentarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].texto").value("Já revisei"));
    }

    @Test
    @WithMockUser
    void listarComentariosSemAcessoAoProjetoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardComentarioService.listar(eq(1L), any())).thenThrow(new AcessoNegadoException("sem acesso"));

        mockMvc.perform(get("/cards/1/comentarios")).andExpect(status().isForbidden());
    }

    @Test
    void listarEventosSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/cards/1/eventos")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaEventosQuandoTemAcesso() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardEventoService.listar(eq(1L), any()))
                .thenReturn(java.util.List.of(new CardEventoResponse(1L, 1L, 2L, "CRIACAO", null, "A fazer", Instant.now())));

        mockMvc.perform(get("/cards/1/eventos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tipo").value("CRIACAO"));
    }

    @Test
    @WithMockUser
    void listarEventosSemAcessoAoProjetoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardEventoService.listar(eq(1L), any())).thenThrow(new AcessoNegadoException("sem acesso"));

        mockMvc.perform(get("/cards/1/eventos")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void listarEventosDeCardInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardEventoService.listar(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/cards/999/eventos")).andExpect(status().isNotFound());
    }
}
