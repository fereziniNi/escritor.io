package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.service.ColunaService;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.web.ColunaComCardsResponse;
import io.escritor.presenca.kanban.web.ColunaResponse;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjetoController.class)
@Import({SecurityConfig.class, JwtService.class})
class ProjetoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjetoService projetoService;

    @MockitoBean
    private ColunaService colunaService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    private static final String CORPO_PROJETO = """
            {"nome":"Portal","cliente":"Acme","status":"ATIVO","inicio":"2026-01-01"}
            """;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.GESTOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCriaProjeto() throws Exception {
        Usuario criador = usuarioComId(10L);
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(criador);
        when(projetoService.criar(any(), eq(criador)))
                .thenReturn(new ProjetoResponse(1L, "Portal", "Acme", null, null, null));

        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorTambemCriaProjeto() throws Exception {
        Usuario criador = usuarioComId(10L);
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(criador);
        when(projetoService.criar(any(), eq(criador)))
                .thenReturn(new ProjetoResponse(1L, "Portal", "Acme", null, null, null));

        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorNaoCriaProjeto() throws Exception {
        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isForbidden());
    }

    @Test
    void criarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/projetos").contentType(MediaType.APPLICATION_JSON).content(CORPO_PROJETO))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoListaSeusProjetosVisiveis() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(projetoService.listarVisiveis(any())).thenReturn(List.of());

        mockMvc.perform(get("/projetos")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void buscarDetalheRetornaColunasCardsEMembros() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(projetoService.buscarDetalhe(eq(1L), any()))
                .thenReturn(new ProjetoDetalheResponse(
                        1L,
                        "Portal",
                        "Acme",
                        StatusProjeto.ATIVO,
                        LocalDate.of(2026, 1, 1),
                        null,
                        List.of(new ColunaComCardsResponse(
                                5L,
                                "A fazer",
                                0,
                                null,
                                List.of(new CardResponse(
                                        7L, 5L, "Corrigir bug", null, 1024.0, null, null, null, 1L,
                                        java.time.Instant.parse("2026-01-15T09:00:00Z"), false)))),
                        List.of(new MembroProjetoResponse(1L, "Ana Souza"))));

        mockMvc.perform(get("/projetos/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Portal"))
                .andExpect(jsonPath("$.colunas[0].nome").value("A fazer"))
                .andExpect(jsonPath("$.colunas[0].cards[0].titulo").value("Corrigir bug"))
                .andExpect(jsonPath("$.membros[0].usuarioNome").value("Ana Souza"));
    }

    @Test
    @WithMockUser
    void buscarDetalheDeProjetoInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(projetoService.buscarDetalhe(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/projetos/999")).andExpect(status().isNotFound());
    }

    @Test
    void adicionarMembroSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/projetos/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":2}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void adicionarMembroComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(post("/projetos/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":2}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void adicionarMembroComPapelGestorRetorna204() throws Exception {
        mockMvc.perform(post("/projetos/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":2}
                                """))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void adicionarMembroDeUsuarioInexistenteRetorna404() throws Exception {
        org.mockito.Mockito.doThrow(new RecursoNaoEncontradoException("não encontrado"))
                .when(projetoService)
                .adicionarMembro(eq(1L), any());

        mockMvc.perform(post("/projetos/1/membros")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usuarioId":999}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void criarColunaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/projetos/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarColunaComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(post("/projetos/1/colunas")
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

        mockMvc.perform(post("/projetos/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nome").value("A fazer"))
                .andExpect(jsonPath("$.projetoId").value(1));
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaSemNomeRetorna400() throws Exception {
        mockMvc.perform(post("/projetos/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ordem":0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void criarColunaEmProjetoInexistenteRetorna404() throws Exception {
        when(colunaService.criar(999L, "A fazer", 0, null))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/projetos/999/colunas")
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

        mockMvc.perform(post("/projetos/1/colunas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"A fazer","ordem":0}
                                """))
                .andExpect(status().isConflict());
    }
}
