package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloRoupa;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
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
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UsuarioController.class)
@Import({SecurityConfig.class, JwtService.class})
class UsuarioControllerTest {

    private static final String CORPO_REQUISICAO = """
            {"nome":"Ana Souza","email":"ana@escritor.io","papel":"COLABORADOR","cargaDiariaMinutos":360}
            """;

    private static final AparenciaAvatarResponse APARENCIA_PADRAO = new AparenciaAvatarResponse(
            "#f2c9a0", EstiloCabelo.CURTO, "#4a3728", EstiloRoupa.CAMISETA, "#6b7280", TipoOculos.NENHUM, TipoChapeu.NENHUM, TipoBarba.NENHUM);

    private static final String CORPO_APARENCIA_VALIDA = """
            {"corPele":"#f2c9a0","estiloCabelo":"CURTO","corCabelo":"#4a3728","estiloRoupa":"CAMISETA",
             "corRoupa":"#6b7280","oculos":"NENHUM","chapeu":"NENHUM","tipoBarba":"BIGODE"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UsuarioService usuarioService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

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
                .thenReturn(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, true, APARENCIA_PADRAO));

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

    @Test
    void rejeitaListagemSemAutenticacao() throws Exception {
        mockMvc.perform(get("/usuarios")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaListagemParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(get("/usuarios")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void listaUsuariosParaAdmin() throws Exception {
        when(usuarioService.listar())
                .thenReturn(java.util.List.of(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, true, APARENCIA_PADRAO)));

        mockMvc.perform(get("/usuarios"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Ana Souza"))
                .andExpect(jsonPath("$[0].cargaDiariaMinutos").value(360));
    }

    @Test
    void rejeitaListagemBasicaSemAutenticacao() throws Exception {
        mockMvc.perform(get("/usuarios/basico")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void listagemBasicaEAbertaAQualquerPapelAutenticado() throws Exception {
        when(usuarioService.listarBasico()).thenReturn(java.util.List.of(new UsuarioBasicoResponse(1L, "Ana Souza")));

        mockMvc.perform(get("/usuarios/basico"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].nome").value("Ana Souza"));
    }

    @Test
    void rejeitaAtualizarCargaDiariaSemAutenticacao() throws Exception {
        mockMvc.perform(patch("/usuarios/1/carga-diaria")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cargaDiariaMinutos":360}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitaAtualizarCargaDiariaParaPapelNaoAdmin() throws Exception {
        mockMvc.perform(patch("/usuarios/1/carga-diaria")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cargaDiariaMinutos":360}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void permiteAtualizarCargaDiariaParaAdmin() throws Exception {
        when(usuarioService.atualizarCargaDiaria(eq(1L), any()))
                .thenReturn(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 420, true, APARENCIA_PADRAO));

        mockMvc.perform(patch("/usuarios/1/carga-diaria")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cargaDiariaMinutos":420}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cargaDiariaMinutos").value(420));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejeitaAtualizarCargaDiariaNaoPositivaComoBadRequest() throws Exception {
        mockMvc.perform(patch("/usuarios/1/carga-diaria")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cargaDiariaMinutos":0}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void atualizarCargaDiariaDeUsuarioInexistenteRetorna404() throws Exception {
        when(usuarioService.atualizarCargaDiaria(eq(999L), any()))
                .thenThrow(new RecursoNaoEncontradoException("Usuário não encontrado"));

        mockMvc.perform(patch("/usuarios/999/carga-diaria")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cargaDiariaMinutos":360}
                                """))
                .andExpect(status().isNotFound());
    }

    private static Usuario usuarioAutenticadoFalso() {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", 1L);
        return usuario;
    }

    @Test
    void rejeitaMeuUsuarioSemAutenticacao() throws Exception {
        mockMvc.perform(get("/usuarios/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoVeOProprioUsuario() throws Exception {
        Usuario eu = usuarioAutenticadoFalso();
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(eu);
        when(usuarioService.buscarMeuUsuario(eu))
                .thenReturn(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480, true, APARENCIA_PADRAO));

        mockMvc.perform(get("/usuarios/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Ana Souza"))
                .andExpect(jsonPath("$.aparencia.estiloCabelo").value("CURTO"));
    }

    @Test
    void rejeitaAtualizarMinhaAparenciaSemAutenticacao() throws Exception {
        mockMvc.perform(patch("/usuarios/me/aparencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void qualquerUsuarioAutenticadoAtualizaAPropriaAparencia() throws Exception {
        Usuario eu = usuarioAutenticadoFalso();
        AparenciaAvatarResponse aparenciaNova = new AparenciaAvatarResponse(
                "#f2c9a0", EstiloCabelo.CURTO, "#4a3728", EstiloRoupa.CAMISETA, "#6b7280", TipoOculos.NENHUM, TipoChapeu.NENHUM, TipoBarba.BIGODE);
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(eu);
        when(usuarioService.atualizarMinhaAparencia(eq(eu), any()))
                .thenReturn(new UsuarioResponse(1L, "Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480, true, aparenciaNova));

        mockMvc.perform(patch("/usuarios/me/aparencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO_APARENCIA_VALIDA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aparencia.tipoBarba").value("BIGODE"));
    }

    @Test
    @WithMockUser
    void atualizarAparenciaComEstiloInvalidoRetorna400() throws Exception {
        mockMvc.perform(patch("/usuarios/me/aparencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"corPele":"#f2c9a0","estiloCabelo":"NAO_EXISTE","corCabelo":"#4a3728","estiloRoupa":"CAMISETA",
                                 "corRoupa":"#6b7280","oculos":"NENHUM","chapeu":"NENHUM","tipoBarba":"NENHUM"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void atualizarAparenciaSemInformarNenhumCampoRetorna400() throws Exception {
        mockMvc.perform(patch("/usuarios/me/aparencia")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
