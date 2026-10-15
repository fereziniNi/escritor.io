package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.service.FechamentoMesService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FechamentoMesController.class)
@Import({SecurityConfig.class, JwtService.class})
class FechamentoMesControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FechamentoMesService fechamentoMesService;

    private static final FechamentoMesResponse FECHAMENTO = new FechamentoMesResponse(
            "2026-09", List.of(new FechamentoMesPessoaResponse(2L, "Nícolas", 360, 20, 7350, 150, 1, 0)));

    @Test
    void rejeitaSemAutenticacao() throws Exception {
        mockMvc.perform(get("/admin/ponto/fechamento-mensal")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(get("/admin/ponto/fechamento-mensal")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveFechamentoDoMesPedido() throws Exception {
        when(fechamentoMesService.fechamento(YearMonth.of(2026, 9))).thenReturn(FECHAMENTO);

        mockMvc.perform(get("/admin/ponto/fechamento-mensal").param("mes", "2026-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mes").value("2026-09"))
                .andExpect(jsonPath("$.pessoas[0].nome").value("Nícolas"))
                .andExpect(jsonPath("$.pessoas[0].saldoMinutos").value(150));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void exportaExcelComoAnexo() throws Exception {
        when(fechamentoMesService.fechamento(isNull())).thenReturn(FECHAMENTO);

        mockMvc.perform(get("/admin/ponto/fechamento-mensal").param("formato", "xlsx"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"fechamento-2026-09.xlsx\""));
    }
}
