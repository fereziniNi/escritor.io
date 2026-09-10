package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import io.escritor.presenca.relatorio.domain.PreferenciasConteudoRelatorioDiario;
import io.escritor.presenca.relatorio.service.ConfiguracaoRelatorioDiarioService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento" - só ADMIN
 * (mesma disciplina de `WhatsAppIntegracaoControllerTest`). Pedido do usuário (V47): "adicionar
 * mais informações... personalizado para o admin" - `preferencias` (os seis campos `incluir*`).
 */
@WebMvcTest(ConfiguracaoRelatorioDiarioController.class)
@Import({SecurityConfig.class, JwtService.class})
class ConfiguracaoRelatorioDiarioControllerTest {

    private static final String CORPO_PADRAO =
            "\"incluirPonto\":true,\"incluirTarefasCriadasMovidas\":true,\"incluirTarefasConcluidas\":false,"
                    + "\"incluirReunioes\":false,\"incluirAusencias\":false,\"incluirResumoEquipe\":false";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConfiguracaoRelatorioDiarioService configuracaoService;

    @Test
    void rejeitaBuscarSemAutenticacao() throws Exception {
        mockMvc.perform(get("/admin/relatorio-diario")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaBuscarParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(get("/admin/relatorio-diario")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveNaoConfiguradoQuandoNenhumAdminAindaEscolheuUmHorario() throws Exception {
        when(configuracaoService.buscar()).thenReturn(null);

        mockMvc.perform(get("/admin/relatorio-diario"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configurado").value(false))
                // sem configuração ainda, os checkboxes já nascem no padrão de sempre (ponto +
                // tarefas), não tudo desmarcado.
                .andExpect(jsonPath("$.preferencias.ponto").value(true))
                .andExpect(jsonPath("$.preferencias.tarefasConcluidas").value(false));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveOHorarioJaConfigurado() throws Exception {
        when(configuracaoService.buscar())
                .thenReturn(new ConfiguracaoRelatorioDiario(
                        LocalTime.of(18, 0), true,
                        new PreferenciasConteudoRelatorioDiario(true, false, true, true, false, true), Instant.now()));

        mockMvc.perform(get("/admin/relatorio-diario"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configurado").value(true))
                .andExpect(jsonPath("$.horarioEnvio").value("18:00:00"))
                .andExpect(jsonPath("$.habilitado").value(true))
                .andExpect(jsonPath("$.preferencias.ponto").value(true))
                .andExpect(jsonPath("$.preferencias.tarefasCriadasMovidas").value(false))
                .andExpect(jsonPath("$.preferencias.tarefasConcluidas").value(true))
                .andExpect(jsonPath("$.preferencias.reunioes").value(true))
                .andExpect(jsonPath("$.preferencias.ausencias").value(false))
                .andExpect(jsonPath("$.preferencias.resumoEquipe").value(true));
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaAtualizarParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(put("/admin/relatorio-diario")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"horarioEnvio\":\"18:00:00\",\"habilitado\":true," + CORPO_PADRAO + "}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void permiteAdminAtualizarOHorarioEAsPreferencias() throws Exception {
        when(configuracaoService.salvar(eq(LocalTime.of(18, 30)), eq(true), eq(PreferenciasConteudoRelatorioDiario.padrao())))
                .thenReturn(new ConfiguracaoRelatorioDiario(LocalTime.of(18, 30), true, PreferenciasConteudoRelatorioDiario.padrao(), Instant.now()));

        mockMvc.perform(put("/admin/relatorio-diario")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"horarioEnvio\":\"18:30:00\",\"habilitado\":true," + CORPO_PADRAO + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.horarioEnvio").value("18:30:00"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejeitaAtualizarSemHorario() throws Exception {
        mockMvc.perform(put("/admin/relatorio-diario")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"habilitado\":true," + CORPO_PADRAO + "}"))
                .andExpect(status().isBadRequest());
    }
}
