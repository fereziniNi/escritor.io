package io.escritor.presenca.happyhour.web;

import io.escritor.presenca.happyhour.domain.NenhumaAtividadeParaSortearException;
import io.escritor.presenca.happyhour.service.HappyHourService;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pedido do usuário: mural do Happy Hour - aberto a qualquer usuário autenticado, mesmo molde de
 * {@code SessaoTrabalhoControllerTest}. */
@WebMvcTest(HappyHourController.class)
@Import({SecurityConfig.class, JwtService.class})
class HappyHourControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HappyHourService happyHourService;

    @MockitoBean
    private ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    @Test
    void listarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/happy-hour/atividades")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listarRetornaAsAtividades() throws Exception {
        when(happyHourService.listar())
                .thenReturn(List.of(new AtividadeResponse(1L, "Karaokê", "Ana Souza", Instant.parse("2026-01-13T18:00:00Z"), null)));

        mockMvc.perform(get("/happy-hour/atividades"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].descricao").value("Karaokê"));
    }

    @Test
    @WithMockUser
    void sugerirComDescricaoValidaRetorna201() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(happyHourService.sugerir(eq("Boliche"), any()))
                .thenReturn(new AtividadeResponse(2L, "Boliche", "Ana Souza", Instant.parse("2026-01-13T18:00:00Z"), null));

        mockMvc.perform(post("/happy-hour/atividades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":"Boliche"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.descricao").value("Boliche"));
    }

    @Test
    @WithMockUser
    void sugerirComDescricaoEmBrancoRetorna400() throws Exception {
        mockMvc.perform(post("/happy-hour/atividades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"descricao":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser
    void sortearComAtividadesRetornaAEscolhida() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(happyHourService.sortear(any()))
                .thenReturn(new AtividadeResponse(1L, "Karaokê", "Ana Souza", Instant.parse("2026-01-13T18:00:00Z"), Instant.parse("2026-01-13T19:00:00Z")));

        mockMvc.perform(post("/happy-hour/sortear"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descricao").value("Karaokê"));
    }

    @Test
    @WithMockUser
    void sortearSemAtividadesRetorna409() throws Exception {
        when(contextoUsuarioAutenticado.usuarioAtual()).thenReturn(null);
        when(happyHourService.sortear(any())).thenThrow(new NenhumaAtividadeParaSortearException());

        mockMvc.perform(post("/happy-hour/sortear")).andExpect(status().isConflict());
    }

    @Test
    @WithMockUser
    void sorteioAtualComAlgoSorteadoRetorna200() throws Exception {
        when(happyHourService.sorteioAtual())
                .thenReturn(Optional.of(new AtividadeResponse(1L, "Karaokê", "Ana Souza", Instant.parse("2026-01-13T18:00:00Z"), Instant.parse("2026-01-13T19:00:00Z"))));

        mockMvc.perform(get("/happy-hour/sorteio"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.descricao").value("Karaokê"));
    }

    @Test
    @WithMockUser
    void sorteioAtualSemNadaSorteadoRetorna204() throws Exception {
        when(happyHourService.sorteioAtual()).thenReturn(Optional.empty());

        mockMvc.perform(get("/happy-hour/sorteio")).andExpect(status().isNoContent());
    }
}
