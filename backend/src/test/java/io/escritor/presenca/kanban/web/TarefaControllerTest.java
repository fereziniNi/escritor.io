package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.domain.EstadoTarefa;
import io.escritor.presenca.kanban.service.TarefaService;
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
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TarefaController.class)
@Import({SecurityConfig.class, JwtService.class})
class TarefaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TarefaService tarefaService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    private static TarefaResponse resposta(EstadoTarefa estado) {
        return new TarefaResponse(7L, "Escrever", null, null, true, estado, LocalDate.of(2026, 12, 1), 30, null);
    }

    @Test
    @WithMockUser
    void getMinhasDevolve200ComLista() throws Exception {
        when(tarefaService.listarMinhas(any())).thenReturn(List.of(resposta(EstadoTarefa.A_FAZER)));

        mockMvc.perform(get("/tarefas/minhas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cardId").value(7))
                .andExpect(jsonPath("$[0].estado").value("A_FAZER"));
    }

    @Test
    @WithMockUser
    void postCriaEDevolve201() throws Exception {
        when(tarefaService.criar(any(), eq("Escrever"), eq(3L), eq(LocalDate.of(2026, 12, 1)), eq(30)))
                .thenReturn(resposta(EstadoTarefa.A_FAZER));

        mockMvc.perform(post("/tarefas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"Escrever","projetoId":3,"prazo":"2026-12-01","estimativaMinutos":30}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cardId").value(7));
    }

    @Test
    @WithMockUser
    void postComTituloEmBrancoDevolve400() throws Exception {
        for (String titulo : new String[] {"   ", ""}) {
            mockMvc.perform(post("/tarefas")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"titulo\":\"" + titulo + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        verify(tarefaService, never()).criar(any(), any(), any(), any(), any());
    }

    @Test
    @WithMockUser
    void postComEstimativaZeroDevolve400() throws Exception {
        mockMvc.perform(post("/tarefas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titulo":"Escrever","estimativaMinutos":0}
                                """))
                .andExpect(status().isBadRequest());
        verify(tarefaService, never()).criar(any(), any(), any(), any(), any());
    }

    @Test
    @WithMockUser
    void patchDevolve200() throws Exception {
        when(tarefaService.mudarEstado(eq(7L), eq(EstadoTarefa.FEITO), any()))
                .thenReturn(resposta(EstadoTarefa.FEITO));

        mockMvc.perform(patch("/tarefas/7/estado")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"estado":"FEITO"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("FEITO"));
    }

    @Test
    void semAutenticacaoDevolve401() throws Exception {
        mockMvc.perform(get("/tarefas/minhas")).andExpect(status().isUnauthorized());
        verifyNoInteractions(tarefaService);
    }
}
