package io.escritor.presenca.escritorio.web;

import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.service.MapaService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import java.util.List;
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

@WebMvcTest(MapaController.class)
@Import({SecurityConfig.class, JwtService.class})
class MapaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MapaService mapaService;

    @Test
    void semAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/mapas/ativo")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void retornaOMapaAtivoComSuasZonas() throws Exception {
        when(mapaService.buscarAtivo())
                .thenReturn(new MapaDetalheResponse(
                        1L, "Escritório", 20, 15, "{\"paredes\": []}", List.of(new ZonaResponse(10L, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO))));

        mockMvc.perform(get("/mapas/ativo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Escritório"))
                .andExpect(jsonPath("$.larguraTiles").value(20))
                .andExpect(jsonPath("$.alturaTiles").value(15))
                .andExpect(jsonPath("$.zonas", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.zonas[0].nome").value("Sala de foco"))
                .andExpect(jsonPath("$.zonas[0].tipo").value("FOCO"));
    }

    @Test
    @WithMockUser
    void semMapaAtivoRetorna404() throws Exception {
        when(mapaService.buscarAtivo()).thenThrow(new RecursoNaoEncontradoException("Nenhum mapa ativo"));

        mockMvc.perform(get("/mapas/ativo")).andExpect(status().isNotFound());
    }
}
