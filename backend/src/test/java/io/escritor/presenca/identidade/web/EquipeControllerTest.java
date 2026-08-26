package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.EquipeService;
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

@WebMvcTest(EquipeController.class)
@Import({SecurityConfig.class, JwtService.class})
class EquipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EquipeService equipeService;

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCriaEquipe() throws Exception {
        when(equipeService.criar(any())).thenReturn(new EquipeResponse(1L, "Backend", null, true));

        mockMvc.perform(post("/equipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backend","descricao":"Time de backend"}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorNaoCriaEquipe() throws Exception {
        mockMvc.perform(post("/equipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backend","descricao":"Time de backend"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorNaoCriaEquipe() throws Exception {
        mockMvc.perform(post("/equipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backend","descricao":"Time de backend"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void qualquerUsuarioAutenticadoListaEquipes() throws Exception {
        when(equipeService.listar()).thenReturn(java.util.List.of());

        mockMvc.perform(get("/equipes")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorNaoAdicionaMembro() throws Exception {
        mockMvc.perform(post("/equipes/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":2,"papelNaEquipe":"MEMBRO"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminAdicionaMembro() throws Exception {
        mockMvc.perform(post("/equipes/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":2,"papelNaEquipe":"MEMBRO"}
                                """))
                .andExpect(status().isNoContent());
    }
}
