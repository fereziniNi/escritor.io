package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.RelatorioTrabalhoService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Mesmos dois caminhos de sempre ("/apontamentos...") - "onde o tempo foi", agora somando o
 * cronômetro em vez do antigo lançamento manual (módulo removido). */
@WebMvcTest(RelatorioTrabalhoController.class)
@Import({SecurityConfig.class, JwtService.class})
class RelatorioTrabalhoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RelatorioTrabalhoService relatorioTrabalhoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

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
    void listarTotalPorCardRetornaOTotalPorCardDoUsuarioAutenticado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(relatorioTrabalhoService.listarTotalPorCard(isNull(), eq(Instant.parse("2026-01-01T00:00:00Z")), eq(Instant.parse("2026-02-01T00:00:00Z")), any()))
                .thenReturn(List.of(new TotalPorCardResponse(10L, "Corrigir bug", 45)));

        mockMvc.perform(get("/apontamentos")
                        .param("agrupar", "card")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cardId").value(10))
                .andExpect(jsonPath("$[0].cardTitulo").value("Corrigir bug"))
                .andExpect(jsonPath("$[0].totalMinutos").value(45));
    }

    @Test
    @WithMockUser
    void listarTotalPorCardComUsuarioIdRepassaOFiltro() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(relatorioTrabalhoService.listarTotalPorCard(eq(3L), any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/apontamentos")
                        .param("agrupar", "card")
                        .param("usuarioId", "3")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk());
    }

    @Test
    void totalApontadoPorProjetoSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "5")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void totalApontadoPorProjetoColaboradorNaoTemAcessoRetorna403() throws Exception {
        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "5")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void totalApontadoPorProjetoGestorRecebeOTotal() throws Exception {
        when(relatorioTrabalhoService.totalApontadoPorProjeto(5L, Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-02-01T00:00:00Z")))
                .thenReturn(new TotalApontadoResponse(90));

        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("projetoId", "5")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutos").value(90));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void totalApontadoPorProjetoSemProjetoIdRetorna400() throws Exception {
        mockMvc.perform(get("/apontamentos/relatorio")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isBadRequest());
    }
}
