package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.escritorio.web.MapaDetalheResponse;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MapaServiceTest {

    @Mock
    private MapaRepository mapaRepository;

    @Mock
    private ZonaRepository zonaRepository;

    private MapaService mapaService;

    private final Mapa mapa = new Mapa("Escritório", 20, 15, "{\"paredes\": []}", true);

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        mapaService = new MapaService(mapaRepository, zonaRepository);
        ReflectionTestUtils.setField(mapa, "id", 1L);
    }

    @Test
    void retornaOMapaAtivoComSuasZonas() {
        Zona zona = new Zona(mapa, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO);
        ReflectionTestUtils.setField(zona, "id", 10L);
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(mapa));
        when(zonaRepository.findByMapa(mapa)).thenReturn(List.of(zona));

        MapaDetalheResponse resposta = mapaService.buscarAtivo();

        assertThat(resposta.id()).isEqualTo(1L);
        assertThat(resposta.nome()).isEqualTo("Escritório");
        assertThat(resposta.larguraTiles()).isEqualTo(20);
        assertThat(resposta.alturaTiles()).isEqualTo(15);
        assertThat(resposta.layoutJson()).isEqualTo("{\"paredes\": []}");
        assertThat(resposta.zonas()).hasSize(1);
        assertThat(resposta.zonas().get(0).nome()).isEqualTo("Sala de foco");
        assertThat(resposta.zonas().get(0).tipo()).isEqualTo(TipoZona.FOCO);
    }

    @Test
    void semMapaAtivoLancaRecursoNaoEncontrado() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mapaService.buscarAtivo()).isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
