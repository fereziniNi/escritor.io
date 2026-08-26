package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.AutenticacaoService;
import io.escritor.presenca.seguranca.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
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
}
