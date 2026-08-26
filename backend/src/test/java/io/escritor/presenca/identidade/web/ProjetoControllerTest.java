package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjetoController.class)
@Import({SecurityConfig.class, JwtService.class})
class ProjetoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjetoService projetoService;

    private static final String CORPO_PROJETO = """
            {"nome":"Portal","cliente":"Acme","status":"ATIVO","inicio":"2026-01-01"}
            """;

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCriaProjeto() throws Exception {
        when(projetoService.criar(any()))
                .thenReturn(new ProjetoResponse(1L, "Portal", "Acme", null, null, null));

        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorNaoCriaProjeto() throws Exception {
        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void qualquerUsuarioAutenticadoListaProjetos() throws Exception {
        when(projetoService.listar()).thenReturn(java.util.List.of());

        mockMvc.perform(get("/projetos")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorNaoVinculaEquipe() throws Exception {
        mockMvc.perform(post("/projetos/1/equipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"equipeId":2}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminVinculaEquipe() throws Exception {
        mockMvc.perform(post("/projetos/1/equipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"equipeId":2}
                                """))
                .andExpect(status().isNoContent());
    }
}
