package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.notificacao.EstadoWhatsApp;
import io.escritor.presenca.ponto.notificacao.EvolutionInstanceService;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??" - só
 * ADMIN acessa (mesma disciplina de `UsuarioControllerTest`: configuração operacional).
 */
@WebMvcTest(WhatsAppIntegracaoController.class)
@Import({SecurityConfig.class, JwtService.class})
class WhatsAppIntegracaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EvolutionInstanceService evolutionInstanceService;

    @Test
    void rejeitaSemAutenticacao() throws Exception {
        mockMvc.perform(get("/admin/whatsapp/estado")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(get("/admin/whatsapp/estado")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveEstadoConectadoParaAdmin() throws Exception {
        when(evolutionInstanceService.buscarEstado()).thenReturn(EstadoWhatsApp.conectado());

        mockMvc.perform(get("/admin/whatsapp/estado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("CONECTADO"))
                .andExpect(jsonPath("$.qrCodeBase64").doesNotExist());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveQrCodeQuandoAguardandoConexao() throws Exception {
        when(evolutionInstanceService.buscarEstado()).thenReturn(EstadoWhatsApp.aguardandoQrCode("data:image/png;base64,abc123"));

        mockMvc.perform(get("/admin/whatsapp/estado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("AGUARDANDO_QRCODE"))
                .andExpect(jsonPath("$.qrCodeBase64").value("data:image/png;base64,abc123"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void devolveMensagemQuandoIndisponivel() throws Exception {
        when(evolutionInstanceService.buscarEstado()).thenReturn(EstadoWhatsApp.indisponivel("Evolution API fora do ar"));

        mockMvc.perform(get("/admin/whatsapp/estado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("INDISPONIVEL"))
                .andExpect(jsonPath("$.mensagem").value("Evolution API fora do ar"));
    }
}
