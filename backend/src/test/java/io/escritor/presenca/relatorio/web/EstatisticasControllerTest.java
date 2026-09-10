package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.relatorio.domain.EstatisticasDeOutroUsuarioException;
import io.escritor.presenca.relatorio.service.EstatisticasService;
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

@WebMvcTest(EstatisticasController.class)
@Import({SecurityConfig.class, JwtService.class})
class EstatisticasControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EstatisticasService estatisticasService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/relatorios/estatisticas")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void retornaAsEstatisticasDoUsuarioAutenticado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        EstatisticasPessoaisResponse pessoal = new EstatisticasPessoaisResponse(
                960, 2, 480, 3, 1, List.of(), 1, List.of());
        EstatisticasEquipeResponse equipe = new EstatisticasEquipeResponse(List.of(), List.of(), List.of(), List.of());
        when(estatisticasService.calcular(
                        isNull(), eq(Instant.parse("2026-01-01T00:00:00Z")), eq(Instant.parse("2026-02-01T00:00:00Z")), any()))
                .thenReturn(new EstatisticasResponse(pessoal, equipe));

        mockMvc.perform(get("/relatorios/estatisticas")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pessoal.totalMinutosTrabalhados").value(960))
                .andExpect(jsonPath("$.pessoal.diasTrabalhados").value(2))
                .andExpect(jsonPath("$.pessoal.tarefasConcluidas").value(1));
    }

    @Test
    @WithMockUser
    void usuarioIdDeOutraPessoaSemAcessoRetorna403() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(estatisticasService.calcular(eq(7L), any(), any(), any())).thenThrow(new EstatisticasDeOutroUsuarioException());

        mockMvc.perform(get("/relatorios/estatisticas")
                        .param("usuarioId", "7")
                        .param("inicio", "2026-01-01T00:00:00Z")
                        .param("fim", "2026-02-01T00:00:00Z"))
                .andExpect(status().isForbidden());
    }
}
