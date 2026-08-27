package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
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
    void estadoAtualDeQuemEstaEmPausaSoOfereceRetomar() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(pontoService.estadoAtual(any()))
                .thenReturn(new EstadoAtualPontoResponse(
                        TipoRegistroPonto.PAUSA_INICIO, java.util.Set.of(TipoRegistroPonto.PAUSA_FIM)));

        mockMvc.perform(get("/ponto/estado-atual"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ultimoTipo").value("PAUSA_INICIO"))
                .andExpect(jsonPath("$.proximasOpcoes", org.hamcrest.Matchers.contains("PAUSA_FIM")));
    }
}
