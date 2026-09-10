package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.CronometroJaEmAndamentoException;
import io.escritor.presenca.kanban.domain.CronometroNaoIniciadoException;
import io.escritor.presenca.kanban.service.SessaoTrabalhoService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pedido do usuário: "um contador de tempo onde a pessoa inicia, pausa e finaliza" - aberto a
 * qualquer usuário autenticado, mesmo molde de {@code CardControllerTest#qualquerUsuarioAutenticadoPodeMoverCard}. */
@WebMvcTest(SessaoTrabalhoController.class)
@Import({SecurityConfig.class, JwtService.class})
class SessaoTrabalhoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessaoTrabalhoService sessaoTrabalhoService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void consultarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/cards/1/cronometro")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void consultaOEstadoAtual() throws Exception {
        when(sessaoTrabalhoService.consultar(1L)).thenReturn(new CronometroResponse(1L, Instant.parse("2026-01-13T09:00:00Z"), 30, null, null));

        mockMvc.perform(get("/cards/1/cronometro"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutosFechados").value(30));
    }

    @Test
    void iniciarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/cronometro/iniciar")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoPodeIniciar() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.iniciar(eq(1L), any()))
                .thenReturn(new CronometroResponse(1L, Instant.parse("2026-01-13T09:00:00Z"), 0, null, null));

        mockMvc.perform(post("/cards/1/cronometro/iniciar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.iniciadoEm").exists());
    }

    @Test
    @WithMockUser
    void iniciarComCronometroJaEmAndamentoRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.iniciar(eq(1L), any())).thenThrow(new CronometroJaEmAndamentoException("já em andamento"));

        mockMvc.perform(post("/cards/1/cronometro/iniciar")).andExpect(status().isConflict());
    }

    @Test
    @WithMockUser
    void iniciarEmCardInexistenteRetorna404() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.iniciar(eq(999L), any())).thenThrow(new RecursoNaoEncontradoException("não encontrado"));

        mockMvc.perform(post("/cards/999/cronometro/iniciar")).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser
    void pausaOCronometro() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.pausar(eq(1L), any())).thenReturn(new CronometroResponse(1L, null, 42, null, null));

        mockMvc.perform(post("/cards/1/cronometro/pausar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutosFechados").value(42));
    }

    @Test
    @WithMockUser
    void pausarSemCronometroEmAndamentoRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.pausar(eq(1L), any())).thenThrow(new CronometroNaoIniciadoException("não iniciado"));

        mockMvc.perform(post("/cards/1/cronometro/pausar")).andExpect(status().isConflict());
    }

    @Test
    void finalizarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(post("/cards/1/cronometro/finalizar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":"Corrigido"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void finalizaComADescricaoDoQueFoiFeito() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.finalizar(eq(1L), eq("Corrigido e testado"), any()))
                .thenReturn(new CronometroResponse(1L, null, 60, "Corrigido e testado", Instant.parse("2026-01-13T18:00:00Z")));

        mockMvc.perform(post("/cards/1/cronometro/finalizar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":"Corrigido e testado"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descricaoConclusao").value("Corrigido e testado"));
    }

    @Test
    @WithMockUser
    void finalizarSemDescricaoRetorna400() throws Exception {
        mockMvc.perform(post("/cards/1/cronometro/finalizar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void finalizarTarefaJaFinalizadaRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(sessaoTrabalhoService.finalizar(eq(1L), eq("De novo"), any())).thenThrow(new CronometroJaEmAndamentoException("já finalizada"));

        mockMvc.perform(post("/cards/1/cronometro/finalizar")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":"De novo"}
                                """))
                .andExpect(status().isConflict());
    }
}
