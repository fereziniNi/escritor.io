package io.escritor.presenca.apontamento.web;

import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.ApontamentoJaEncerradoException;
import io.escritor.presenca.apontamento.domain.FiltroRelatorioInvalidoException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.apontamento.service.ApontamentoService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Test
    void editarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(patch("/apontamentos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void donoEditaOProprioApontamento() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.editar(eq(1L), any(), any(), eq("Corrigido"), any()))
                .thenReturn(new ApontamentoResponse(
                        1L, 2L, 5L, Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T13:00:00Z"), 60,
                        "Corrigido", "MANUAL", Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T13:00:00Z")));

        mockMvc.perform(patch("/apontamentos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":"Corrigido"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descricao").value("Corrigido"))
                .andExpect(jsonPath("$.minutos").value(60));
    }

    @Test
    @WithMockUser
    void editarApontamentoDeOutroUsuarioRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.editar(eq(1L), any(), any(), any(), any())).thenThrow(new ApontamentoDeOutroUsuarioException());

        mockMvc.perform(patch("/apontamentos/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void editarApontamentoInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.editar(eq(999L), any(), any(), any(), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(patch("/apontamentos/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void excluirSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(delete("/apontamentos/1")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void donoExcluiOProprioApontamento() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        doNothing().when(apontamentoService).excluir(eq(1L), any());

        mockMvc.perform(delete("/apontamentos/1")).andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser
    void excluirApontamentoDeOutroUsuarioRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        doThrow(new ApontamentoDeOutroUsuarioException()).when(apontamentoService).excluir(eq(1L), any());

        mockMvc.perform(delete("/apontamentos/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void excluirApontamentoInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        doThrow(new RecursoNaoEncontradoException("não encontrado")).when(apontamentoService).excluir(eq(999L), any());

        mockMvc.perform(delete("/apontamentos/999")).andExpect(status().isNotFound());
    }

    @Test
    void listarPorCardSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/cards/1/apontamentos")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaOsApontamentosDoCard() throws Exception {
        when(apontamentoService.listarPorCard(1L))
                .thenReturn(List.of(new ApontamentoResponse(
                        10L, 2L, 1L, Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T13:00:00Z"), 60,
                        null, "MANUAL", Instant.parse("2026-01-15T12:00:00Z"), Instant.parse("2026-01-15T12:00:00Z"))));

        mockMvc.perform(get("/cards/1/apontamentos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].minutos").value(60));
    }

    @Test
    @WithMockUser
    void listarPorCardInexistenteRetorna404() throws Exception {
        when(apontamentoService.listarPorCard(999L)).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/cards/999/apontamentos")).andExpect(status().isNotFound());
    }

    @Test
    void listarPorUsuarioEPeriodoSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/apontamentos").param("inicio", "2026-01-01T00:00:00Z").param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaOsProprosApontamentosSemInformarUsuarioId() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarPorUsuarioEPeriodo(isNull(), any(), any(), any()))
                .thenReturn(List.of(new ApontamentoResponse(
                        1L, 2L, 7L, Instant.parse("2026-01-15T09:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"), 60,
                        null, "MANUAL", Instant.parse("2026-01-15T10:00:00Z"), Instant.parse("2026-01-15T10:00:00Z"))));

        mockMvc.perform(get("/apontamentos").param("inicio", "2026-01-01T00:00:00Z").param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].minutos").value(60));
    }

    @Test
    @WithMockUser
    void listaApontamentosDeOutroUsuarioComUsuarioIdInformado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarPorUsuarioEPeriodo(eq(7L), any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/apontamentos")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void listarApontamentosDeOutroUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarPorUsuarioEPeriodo(eq(7L), any(), any(), any()))
                .thenThrow(new ApontamentoDeOutroUsuarioException());

        mockMvc.perform(get("/apontamentos")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void listarApontamentosDeUsuarioIdInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarPorUsuarioEPeriodo(eq(999L), any(), any(), any()))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/apontamentos")
                        .param("usuarioId", "999")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void listarApontamentosSemInicioOuFimRetorna400() throws Exception {
        mockMvc.perform(get("/apontamentos")).andExpect(status().isBadRequest());
    }

    @Test
    void listarTotalPorCardSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/apontamentos")
                        .param("agrupar", "card")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listaOTotalApontadoPorCard() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarTotalPorCard(isNull(), any(), any(), any()))
                .thenReturn(List.of(new TotalPorCardResponse(5L, 90), new TotalPorCardResponse(6L, 15)));

        mockMvc.perform(get("/apontamentos")
                        .param("agrupar", "card")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cardId").value(5))
                .andExpect(jsonPath("$[0].totalMinutos").value(90))
                .andExpect(jsonPath("$[1].cardId").value(6))
                .andExpect(jsonPath("$[1].totalMinutos").value(15));
    }

    @Test
    @WithMockUser
    void listarTotalPorCardDeUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(apontamentoService.listarTotalPorCard(eq(7L), any(), any(), any())).thenThrow(new ApontamentoDeOutroUsuarioException());

        mockMvc.perform(get("/apontamentos")
                        .param("agrupar", "card")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }

    @Test
    void totalApontadoPorProjetoOuEquipeSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "20")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void totalApontadoPorProjetoOuEquipeComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "20")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void gestorConsultaOTotalApontadoPorProjeto() throws Exception {
        when(apontamentoService.totalApontadoPorProjetoOuEquipe(eq(20L), isNull(), any(), any()))
                .thenReturn(new TotalApontadoResponse(90));

        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "20")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutos").value(90));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminConsultaOTotalApontadoPorEquipe() throws Exception {
        when(apontamentoService.totalApontadoPorProjetoOuEquipe(isNull(), eq(30L), any(), any()))
                .thenReturn(new TotalApontadoResponse(15));

        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("equipeId", "30")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutos").value(15));
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void totalApontadoComProjetoIdEEquipeIdJuntosRetorna400() throws Exception {
        when(apontamentoService.totalApontadoPorProjetoOuEquipe(eq(20L), eq(30L), any(), any()))
                .thenThrow(new FiltroRelatorioInvalidoException("ambíguo"));

        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "20")
                        .param("equipeId", "30")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void totalApontadoPorProjetoInexistenteRetorna404() throws Exception {
        when(apontamentoService.totalApontadoPorProjetoOuEquipe(eq(999L), isNull(), any(), any()))
                .thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "999")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isNotFound());
    }
}
