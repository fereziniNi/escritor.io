package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.TituloCardObrigatorioException;
import io.escritor.presenca.kanban.service.CardService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ColunaController.class)
@Import({SecurityConfig.class, JwtService.class})
class ColunaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CardService cardService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void criarCardSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/colunas/1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"Corrigir bug"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void qualquerUsuarioAutenticadoPodeCriarCard() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.criar(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new CardResponse(
                        1L, 1L, "Corrigir bug", null, 1024.0, null, null, null, 1L, Instant.now(), false));

        mockMvc.perform(post("/colunas/1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"Corrigir bug"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("Corrigir bug"));
    }

    @Test
    @WithMockUser
    void criarCardSemTituloRetorna400() throws Exception {
        mockMvc.perform(post("/colunas/1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void criarCardEmColunaInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.criar(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new RecursoNaoEncontradoException("não encontrada"));

        mockMvc.perform(post("/colunas/999/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"Corrigir bug"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void erroDeDominioTituloObrigatorioMapeiaPara400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(cardService.criar(any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new TituloCardObrigatorioException());

        mockMvc.perform(post("/colunas/1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"válido no DTO, mas o serviço decidiu rejeitar mesmo assim"}
                                """))
                .andExpect(status().isBadRequest());
    }
}
