package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.domain.QuadroSemVinculoException;
import io.escritor.presenca.kanban.service.ColunaService;
import io.escritor.presenca.kanban.service.QuadroService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(QuadroController.class)
@Import({SecurityConfig.class, JwtService.class})
class QuadroControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private QuadroService quadroService;

    @MockitoBean
    private ColunaService colunaService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/quadros")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaOsQuadrosVisiveisAoUsuarioAutenticado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(quadroService.listarVisiveis(any()))
                .thenReturn(List.of(new QuadroResponse(1L, "Backlog", null, 10L, false)));

        mockMvc.perform(get("/quadros"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Backlog"))
                .andExpect(jsonPath("$[0].equipeId").value(10));
    }

    @Test
    void criarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backlog","equipeId":10}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backlog","equipeId":10}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarComPapelGestorRetorna201() throws Exception {
        when(quadroService.criar("Backlog", null, 10L))
                .thenReturn(new QuadroResponse(1L, "Backlog", null, 10L, false));

        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backlog","equipeId":10}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("Backlog"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void criarComPapelAdminRetorna201() throws Exception {
        when(quadroService.criar("Backlog", null, 10L))
                .thenReturn(new QuadroResponse(1L, "Backlog", null, 10L, false));

        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backlog","equipeId":10}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarSemNomeRetorna400() throws Exception {
        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"equipeId":10}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarSemProjetoNemEquipeRetorna400() throws Exception {
        when(quadroService.criar(eq("Órfão"), any(), any())).thenThrow(new QuadroSemVinculoException());

        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Órfão"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarComEquipeInexistenteRetorna404() throws Exception {
        when(quadroService.criar("Backlog", null, 999L))
                .thenThrow(new RecursoNaoEncontradoException("não encontrada"));

        mockMvc.perform(post("/quadros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Backlog","equipeId":999}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void criarColunaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarColunaComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaComPapelGestorRetorna201() throws Exception {
        when(colunaService.criar(1L, "A fazer", 0, null))
                .thenReturn(new ColunaResponse(1L, 1L, "A fazer", 0, null));

        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("A fazer"))
                .andExpect(jsonPath("$.quadroId").value(1));
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaComLimiteWip() throws Exception {
        when(colunaService.criar(1L, "Em progresso", 1, 3))
                .thenReturn(new ColunaResponse(2L, 1L, "Em progresso", 1, 3));

        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Em progresso","ordem":1,"limiteWip":3}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.limiteWip").value(3));
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaSemNomeRetorna400() throws Exception {
        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ordem":0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaEmQuadroInexistenteRetorna404() throws Exception {
        when(colunaService.criar(999L, "A fazer", 0, null))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/quadros/999/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaComOrdemDuplicadaRetorna409() throws Exception {
        when(colunaService.criar(1L, "A fazer", 0, null)).thenThrow(new OrdemColunaDuplicadaException(0));

        mockMvc.perform(post("/quadros/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isConflict());
    }
}
