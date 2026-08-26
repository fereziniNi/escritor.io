package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.AutenticacaoService;
import io.escritor.presenca.identidade.service.CodigoInvalidoException;
import io.escritor.presenca.identidade.service.TokensAutenticacao;
import io.escritor.presenca.seguranca.SecurityConfig;
import io.escritor.presenca.seguranca.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtService.class})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AutenticacaoService autenticacaoService;

    @Test
    void solicitarCodigoNaoExigeAutenticacao() throws Exception {
        mockMvc.perform(post("/auth/codigo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ana@escritor.io"}
                                """))
                .andExpect(status().isAccepted());

        verify(autenticacaoService).solicitarCodigo(anyString());
    }

    @Test
    void rejeitaEmailInvalidoComoBadRequest() throws Exception {
        mockMvc.perform(post("/auth/codigo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nao-e-um-email"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginComCodigoCorretoRetornaAccessTokenESetaCookieDeRefresh() throws Exception {
        when(autenticacaoService.verificarCodigo("ana@escritor.io", "123456"))
                .thenReturn(new TokensAutenticacao("access-token-fake", "refresh-token-fake"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ana@escritor.io","codigo":"123456"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token-fake"))
                .andExpect(cookie().httpOnly("refresh_token", true))
                .andExpect(cookie().value("refresh_token", "refresh-token-fake"));
    }

    @Test
    void loginComCodigoInvalidoRetorna401() throws Exception {
        when(autenticacaoService.verificarCodigo("ana@escritor.io", "000000"))
                .thenThrow(new CodigoInvalidoException());

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ana@escritor.io","codigo":"000000"}
                                """))
                .andExpect(status().isUnauthorized());
    }
}
