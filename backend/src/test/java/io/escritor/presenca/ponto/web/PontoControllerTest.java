package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.service.PontoService;
import io.escritor.presenca.ponto.service.SequenciaInvalidaException;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PontoController.class)
@Import({SecurityConfig.class, JwtService.class})
class PontoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PontoService pontoService;

    @MockitoBean
    private JornadaService jornadaService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/ponto/marcar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void marcacaoValidaRetorna201ComORegistroCriado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(pontoService.marcar(any(), eq(TipoRegistroPonto.ENTRADA), anyString(), anyString()))
                .thenReturn(new RegistroPontoResponse(
                        1L, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T12:00:00Z"), OrigemRegistroPonto.WEB));

        mockMvc.perform(post("/ponto/marcar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("User-Agent", "junit-agent")
                        .content("""
                                {"tipo":"ENTRADA"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("ENTRADA"))
                .andExpect(jsonPath("$.momento").value("2026-01-15T12:00:00Z"));

        verify(pontoService).marcar(any(), eq(TipoRegistroPonto.ENTRADA), anyString(), eq("junit-agent"));
    }

    @Test
    @WithMockUser
    void ignoraMomentoEnviadoPeloCliente() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(pontoService.marcar(any(), eq(TipoRegistroPonto.ENTRADA), any(), any()))
                .thenReturn(new RegistroPontoResponse(
                        1L, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T12:00:00Z"), OrigemRegistroPonto.WEB));

        mockMvc.perform(post("/ponto/marcar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"ENTRADA","momento":"1999-01-01T00:00:00Z"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.momento").value("2026-01-15T12:00:00Z"));
    }

    @Test
    @WithMockUser
    void sequenciaInvalidaRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(pontoService.marcar(any(), eq(TipoRegistroPonto.SAIDA), any(), any()))
                .thenThrow(new SequenciaInvalidaException(null, TipoRegistroPonto.SAIDA));

        mockMvc.perform(post("/ponto/marcar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tipo":"SAIDA"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void estadoAtualSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/ponto/estado-atual")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void estadoAtualDeQuemEstaEmPausaOfereceRetomarOuEncerrar() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(pontoService.estadoAtual(any()))
                .thenReturn(new EstadoAtualPontoResponse(
                        TipoRegistroPonto.PAUSA_INICIO,
                        Instant.parse("2026-01-15T12:00:00Z"),
                        1800L,
                        java.util.Set.of(TipoRegistroPonto.PAUSA_FIM, TipoRegistroPonto.SAIDA)));

        mockMvc.perform(get("/ponto/estado-atual"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ultimoTipo").value("PAUSA_INICIO"))
                .andExpect(jsonPath("$.ultimoMomento").value("2026-01-15T12:00:00Z"))
                .andExpect(jsonPath("$.segundosTrabalhadosAteAgora").value(1800))
                .andExpect(jsonPath("$.proximasOpcoes", org.hamcrest.Matchers.containsInAnyOrder("PAUSA_FIM", "SAIDA")));
    }

    @Test
    void jornadaDoDiaSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/ponto/jornada-do-dia")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void jornadaDoDiaRetornaEstadoESaldo() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.jornadaDoDia(any(), any()))
                .thenReturn(new JornadaDoDiaResponse(
                        java.time.LocalDate.parse("2026-01-13"), EstadoDia.FECHADA, 540, 60, 120, 90));

        mockMvc.perform(get("/ponto/jornada-do-dia"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("2026-01-13"))
                .andExpect(jsonPath("$.estado").value("FECHADA"))
                .andExpect(jsonPath("$.minutosTrabalhados").value(540))
                .andExpect(jsonPath("$.saldoDia").value(60))
                .andExpect(jsonPath("$.saldoAcumuladoNoPeriodo").value(120))
                .andExpect(jsonPath("$.totalApontadoMinutos").value(90));
    }

    @Test
    @WithMockUser
    void jornadaDoDiaComUsuarioIdRepassaOFiltroPraOServico() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.jornadaDoDia(eq(7L), any()))
                .thenReturn(new JornadaDoDiaResponse(java.time.LocalDate.parse("2026-01-13"), EstadoDia.FECHADA, 0, 0, 0, 0));

        mockMvc.perform(get("/ponto/jornada-do-dia").param("usuarioId", "7")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void jornadaDoDiaDeUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.jornadaDoDia(eq(7L), any())).thenThrow(new JornadaDeOutroUsuarioException());

        mockMvc.perform(get("/ponto/jornada-do-dia").param("usuarioId", "7")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void jornadaDoDiaDeUsuarioIdInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.jornadaDoDia(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(get("/ponto/jornada-do-dia").param("usuarioId", "999")).andExpect(status().isNotFound());
    }

    @Test
    void espelhoDoMesSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/ponto/espelho-do-mes")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void espelhoDoMesRetornaOsDiasEOSaldoAcumulado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(any(), any()))
                .thenReturn(new EspelhoMesResponse(
                        java.util.List.of(
                                new EspelhoDiaResponse(java.time.LocalDate.parse("2026-01-12"), EstadoDia.FECHADA, 540, 60),
                                new EspelhoDiaResponse(java.time.LocalDate.parse("2026-01-13"), EstadoDia.FECHADA, 480, 0)),
                        60));

        mockMvc.perform(get("/ponto/espelho-do-mes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dias", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.dias[0].data").value("2026-01-12"))
                .andExpect(jsonPath("$.dias[0].saldoDia").value(60))
                .andExpect(jsonPath("$.saldoAcumuladoNoPeriodo").value(60));
    }

    @Test
    @WithMockUser
    void espelhoDoMesComUsuarioIdRepassaOFiltroPraOServico() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(eq(7L), any())).thenReturn(new EspelhoMesResponse(java.util.List.of(), 0));

        mockMvc.perform(get("/ponto/espelho-do-mes").param("usuarioId", "7")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void espelhoDoMesDeUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(eq(7L), any())).thenThrow(new JornadaDeOutroUsuarioException());

        mockMvc.perform(get("/ponto/espelho-do-mes").param("usuarioId", "7")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void espelhoDoMesComFormatoCsvRetornaTextCsv() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(any(), any()))
                .thenReturn(new EspelhoMesResponse(
                        java.util.List.of(new EspelhoDiaResponse(java.time.LocalDate.parse("2026-01-12"), EstadoDia.FECHADA, 540, 60)), 60));

        mockMvc.perform(get("/ponto/espelho-do-mes").param("formato", "csv"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType("text/csv"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content()
                        .string("Data,Estado,Minutos Trabalhados,Saldo\n2026-01-12,FECHADA,540,60\n"));
    }

    @Test
    @WithMockUser
    void espelhoDoMesCsvComUsuarioIdRepassaOFiltroPraOServico() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(eq(7L), any())).thenReturn(new EspelhoMesResponse(java.util.List.of(), 0));

        mockMvc.perform(get("/ponto/espelho-do-mes").param("formato", "csv").param("usuarioId", "7")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void espelhoDoMesCsvDeUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.espelhoDoMes(eq(7L), any())).thenThrow(new JornadaDeOutroUsuarioException());

        mockMvc.perform(get("/ponto/espelho-do-mes").param("formato", "csv").param("usuarioId", "7")).andExpect(status().isForbidden());
    }

    @Test
    void espelhoDoMesCsvSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/ponto/espelho-do-mes").param("formato", "csv")).andExpect(status().isUnauthorized());
    }

    @Test
    void diasInconsistentesSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/ponto/dias-inconsistentes")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void diasInconsistentesRetornaAsDatas() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.diasInconsistentes(isNull(), any(), any(), any()))
                .thenReturn(java.util.List.of(java.time.LocalDate.parse("2026-01-11"), java.time.LocalDate.parse("2026-01-12")));

        mockMvc.perform(get("/ponto/dias-inconsistentes")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("2026-01-11"))
                .andExpect(jsonPath("$[1]").value("2026-01-12"));
    }

    @Test
    @WithMockUser
    void diasInconsistentesComUsuarioIdRepassaOFiltroPraOServico() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.diasInconsistentes(eq(7L), any(), any(), any())).thenReturn(java.util.List.of());

        mockMvc.perform(get("/ponto/dias-inconsistentes")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void diasInconsistentesDeUsuarioSemPermissaoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(jornadaService.diasInconsistentes(eq(7L), any(), any(), any())).thenThrow(new JornadaDeOutroUsuarioException());

        mockMvc.perform(get("/ponto/dias-inconsistentes")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void diasInconsistentesSemInicioOuFimRetorna400() throws Exception {
        mockMvc.perform(get("/ponto/dias-inconsistentes")).andExpect(status().isBadRequest());
    }
}
