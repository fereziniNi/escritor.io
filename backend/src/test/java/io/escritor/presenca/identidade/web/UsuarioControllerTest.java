package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.service.UsuarioService;
import io.escritor.presenca.seguranca.SecurityConfig;
import io.escritor.presenca.seguranca.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UsuarioController.class)
@Import({SecurityConfig.class, JwtService.class})
class UsuarioControllerTest {

    private static final String CORPO_REQUISICAO = """
            {"nome":"Ana Souza","email":"ana@escritor.io","papel":"COLABORADOR","cargaDiariaMinutos":360}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UsuarioService usuarioService;

    @Test
    void rejeitaCriacaoSemAutenticacao() throws Exception {
        mockMvc.perform(post("/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_REQUISICAO))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaCriacaoParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(post("/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_REQUISICAO))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void permiteCriacaoParaAdmin() throws Exception {
        when(usuarioService.criar(any()))
                .thenReturn(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, true));

        mockMvc.perform(post("/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_REQUISICAO))
                .andExpect(status().isCreated());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejeitaCargaDiariaNaoPositivaComoBadRequest() throws Exception {
        mockMvc.perform(post("/usuarios")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Ana Souza","email":"ana@escritor.io","papel":"COLABORADOR","cargaDiariaMinutos":0}
                                """))
                .andExpect(status().isBadRequest());
    }
}
