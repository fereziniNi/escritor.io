package io.escritor.presenca.escala.web;

import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.googlecalendar.service.GoogleCalendarSincronizacaoService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Todo endpoint da própria escala é sempre sobre o usuário autenticado, então qualquer papel
 * consegue usar (diferente de {@code ProjetoController#adicionarMembro}, por exemplo) - só
 * {@code /escala/equipe} é GESTOR/ADMIN, pedido do usuário: "para o admin/chefe conseguir ver os
 * momentos em que os funcionários estarão trabalhando".
 */
@WebMvcTest(EscalaController.class)
@Import({SecurityConfig.class, JwtService.class})
class EscalaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EscalaService escalaService;

    @MockitoBean
    private GoogleCalendarSincronizacaoService googleSincronizacaoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void listarSemanalSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/escala/semanal")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorListaAPropriaEscalaSemanal() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.listarSemanal(any()))
                .thenReturn(List.of(new EscalaSemanalResponse(1L, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0))));

        mockMvc.perform(get("/escala/semanal"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].diaSemana").value("MONDAY"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorDefineAPropriaEscalaSemanal() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.definirSemanal(any(), any()))
                .thenReturn(List.of(new EscalaSemanalResponse(1L, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0))));

        mockMvc.perform(put("/escala/semanal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"diaSemana":"MONDAY","horaInicio":"09:00","horaFim":"18:00"}]
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].diaSemana").value("MONDAY"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void definirSemanalComItemSemHorarioRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(put("/escala/semanal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                [{"diaSemana":"MONDAY"}]
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorListaAsPropriasExcecoes() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.listarExcecoes(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/escala/excecoes").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorSalvaUmaExcecaoPropria() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.salvarExcecao(any(), any()))
                .thenReturn(new EscalaExcecaoResponse(
                        1L, LocalDate.of(2026, 1, 5), true, LocalTime.of(8, 0), LocalTime.of(12, 0), null));

        mockMvc.perform(post("/escala/excecoes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"data":"2026-01-05","trabalha":true,"horaInicio":"08:00","horaFim":"12:00"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data").value("2026-01-05"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorRemoveUmaExcecaoPropria() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(delete("/escala/excecoes/1")).andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorConsultaAPropriaEscalaEfetiva() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.calcularEfetiva(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/escala/efetiva").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    void disponibilidadeSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/escala/disponibilidade").param("usuarioIds", "2").param("data", "2026-09-10"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorConsultaDisponibilidadeDeQualquerColega() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.consultarDisponibilidade(List.of(2L, 3L), LocalDate.of(2026, 9, 10)))
                .thenReturn(List.of(
                        new DisponibilidadeResponse(2L, "Beto Lima", true, LocalTime.of(9, 0), LocalTime.of(18, 0)),
                        new DisponibilidadeResponse(3L, "Caio Reis", false, null, null)));

        mockMvc.perform(get("/escala/disponibilidade").param("usuarioIds", "2", "3").param("data", "2026-09-10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Beto Lima"))
                .andExpect(jsonPath("$[0].trabalha").value(true))
                .andExpect(jsonPath("$[1].trabalha").value(false));
    }

    @Test
    void equipeSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/escala/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void equipeComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(get("/escala/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void equipeComPapelGestorRetorna200() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.calcularEfetivaDaEquipe(any(), any(), any()))
                .thenReturn(List.of(new EscalaEquipeResponse(1L, "Ana Souza", List.of())));

        mockMvc.perform(get("/escala/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].usuarioNome").value("Ana Souza"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void equipeComPapelAdminRetorna200() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(escalaService.calcularEfetivaDaEquipe(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/escala/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk());
    }
}
