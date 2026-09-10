package io.escritor.presenca.reuniao.web;

import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.reuniao.service.ReuniaoService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pedido do usuário: "onde o usuário do sistema (independente) vai conseguir marcar e entrar nas
 * reuniões do meet" - criar/cancelar/consultar as próprias é qualquer papel autenticado (deixou de
 * ser GESTOR/ADMIN só); só {@code /equipe} (visão de todo mundo) continua GESTOR/ADMIN.
 */
@WebMvcTest(ReuniaoController.class)
@Import({SecurityConfig.class, JwtService.class})
class ReuniaoControllerTest {

    private static final String CORPO_CRIAR = """
            {"participantesIds":[2],"data":"2026-01-05","horaInicio":"14:30","horaFim":"15:00","titulo":"Alinhamento"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReuniaoService reuniaoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void criarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/escala/reunioes").contentType(MediaType.APPLICATION_JSON).content(CORPO_CRIAR))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorCriaUmaReuniao() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(reuniaoService.criar(any(), any()))
                .thenReturn(new ReuniaoResponse(
                        1L, 1L, "Ana", List.of(new ReuniaoResponse.ParticipanteResponse(2L, "Beto")),
                        LocalDate.of(2026, 1, 5), LocalTime.of(14, 30), LocalTime.of(15, 0), "Alinhamento",
                        "https://meet.google.com/abc-defg-hij"));

        mockMvc.perform(post("/escala/reunioes").contentType(MediaType.APPLICATION_JSON).content(CORPO_CRIAR))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.titulo").value("Alinhamento"))
                .andExpect(jsonPath("$.linkMeet").value("https://meet.google.com/abc-defg-hij"))
                .andExpect(jsonPath("$.participantes[0].nome").value("Beto"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarSemParticipantesRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(post("/escala/reunioes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"participantesIds":[],"data":"2026-01-05","horaInicio":"14:30","horaFim":"15:00","titulo":"Alinhamento"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarSemTituloRetorna400() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(post("/escala/reunioes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"participantesIds":[2],"data":"2026-01-05","horaInicio":"14:30","horaFim":"15:00","titulo":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void criarSemGoogleConectadoRetorna428() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(reuniaoService.criar(any(), any())).thenThrow(new GoogleNaoConectadoException());

        mockMvc.perform(post("/escala/reunioes").contentType(MediaType.APPLICATION_JSON).content(CORPO_CRIAR))
                .andExpect(status().is(428));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorListaAsPropriasReunioes() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(reuniaoService.listarMinhas(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/escala/reunioes").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    void equipeSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/escala/reunioes/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void equipeComPapelColaboradorRetorna403() throws Exception {
        mockMvc.perform(get("/escala/reunioes/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminListaAsReunioesDaEquipe() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(reuniaoService.listarDaEquipe(any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get("/escala/reunioes/equipe").param("inicio", "2026-01-01").param("fim", "2026-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void colaboradorCancelaAPropriaReuniao() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(delete("/escala/reunioes/1")).andExpect(status().isNoContent());
    }

    @Test
    void cancelarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(delete("/escala/reunioes/1")).andExpect(status().isUnauthorized());
    }
}
