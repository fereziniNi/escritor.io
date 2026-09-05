package io.escritor.presenca.googlecalendar.web;

import io.escritor.presenca.googlecalendar.domain.EstadoOAuthInvalidoException;
import io.escritor.presenca.googlecalendar.domain.GoogleIntegracaoDesabilitadaException;
import io.escritor.presenca.googlecalendar.service.GoogleOAuthService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code /estado}, {@code /iniciar} e {@code DELETE} exigem autenticação normal (atuam sempre
 * sobre o usuário autenticado); {@code /callback} é público (ver {@code SecurityConfig}) - é a
 * Google redirecionando o navegador de volta, sem header de autenticação.
 */
@WebMvcTest(IntegracaoGoogleController.class)
@Import({SecurityConfig.class, JwtService.class})
class IntegracaoGoogleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GoogleOAuthService oAuthService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void estadoSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/integracoes/google/estado")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void estadoDesabilitadoNaoChecaConexao() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(oAuthService.habilitado()).thenReturn(false);

        mockMvc.perform(get("/integracoes/google/estado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habilitado").value(false))
                .andExpect(jsonPath("$.conectado").value(false));

        verify(oAuthService, org.mockito.Mockito.never()).estaConectado(any());
    }

    @Test
    @WithMockUser
    void estadoHabilitadoEConectado() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(oAuthService.habilitado()).thenReturn(true);
        when(oAuthService.estaConectado(any())).thenReturn(true);

        mockMvc.perform(get("/integracoes/google/estado"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.habilitado").value(true))
                .andExpect(jsonPath("$.conectado").value(true));
    }

    @Test
    @WithMockUser
    void iniciarRetornaAUrlDeAutorizacao() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(oAuthService.iniciarConexao(any())).thenReturn("https://accounts.google.com/o/oauth2/v2/auth?state=abc");

        mockMvc.perform(get("/integracoes/google/iniciar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://accounts.google.com/o/oauth2/v2/auth?state=abc"));
    }

    @Test
    @WithMockUser
    void iniciarComIntegracaoDesabilitadaRetorna503() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(oAuthService.iniciarConexao(any())).thenThrow(new GoogleIntegracaoDesabilitadaException());

        mockMvc.perform(get("/integracoes/google/iniciar")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void callbackSemAutenticacaoNaoRetorna401() throws Exception {
        // /callback é público - a Google redireciona o navegador de volta sem header nenhum
        mockMvc.perform(get("/integracoes/google/callback").param("code", "codigo-123").param("state", "nonce-abc"))
                .andExpect(status().is3xxRedirection());
    }

    @Test
    void callbackComSucessoRedirecionaComGoogleConectado() throws Exception {
        mockMvc.perform(get("/integracoes/google/callback").param("code", "codigo-123").param("state", "nonce-abc"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "/?google=conectado"));

        verify(oAuthService).tratarCallback("codigo-123", "nonce-abc");
    }

    @Test
    void callbackComFalhaRedirecionaComGoogleErro() throws Exception {
        doThrow(new EstadoOAuthInvalidoException()).when(oAuthService).tratarCallback("codigo-ruim", "nonce-ruim");

        mockMvc.perform(get("/integracoes/google/callback").param("code", "codigo-ruim").param("state", "nonce-ruim"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "/?google=erro"));
    }

    @Test
    void callbackSemCodeOuStateRedirecionaComGoogleErro() throws Exception {
        // a Google manda só `error=access_denied` quando o usuário recusa o consentimento
        mockMvc.perform(get("/integracoes/google/callback").param("error", "access_denied"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "/?google=erro"));
    }

    @Test
    void desconectarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(delete("/integracoes/google")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void desconectarComAutenticacaoRetorna204() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);

        mockMvc.perform(delete("/integracoes/google")).andExpect(status().isNoContent());

        verify(oAuthService).desconectar(any());
    }
}
