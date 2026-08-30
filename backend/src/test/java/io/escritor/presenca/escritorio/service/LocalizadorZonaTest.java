package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LocalizadorZonaTest {

    @Mock
    private MapaRepository mapaRepository;

    @Mock
    private ZonaRepository zonaRepository;

    private LocalizadorZona localizadorZona;

    private final Mapa mapa = new Mapa("Escritório", 20, 15, "{}", true);
    private final Zona foco = new Zona(mapa, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO);
    private final Zona reuniao = new Zona(mapa, "Sala de reunião", 5, 0, 5, 5, TipoZona.REUNIAO);

    @BeforeEach
    void setUp() {
        localizadorZona = new LocalizadorZona(mapaRepository, zonaRepository);
    }

    private void comZonasSeedadas() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(mapa));
        when(zonaRepository.findByMapa(mapa)).thenReturn(List.of(foco, reuniao));
    }

    @Test
    void posicaoDentroDeUmaZonaERetornada() {
        comZonasSeedadas();

        assertThat(localizadorZona.zonaContendo(1, 1)).contains(foco);
    }

    @Test
    void posicaoNoCantoSuperiorEsquerdoDaZonaEIncluida() {
        comZonasSeedadas();

        assertThat(localizadorZona.zonaContendo(0, 0)).contains(foco);
    }

    @Test
    void posicaoNoLimiteExclusivoDaZonaNaoEIncluida() {
        comZonasSeedadas();

        assertThat(localizadorZona.zonaContendo(4, 0)).isEmpty();
        assertThat(localizadorZona.zonaContendo(0, 4)).isEmpty();
    }

    @Test
    void posicaoForaDeQualquerZonaRetornaVazio() {
        comZonasSeedadas();

        assertThat(localizadorZona.zonaContendo(8, 8)).isEmpty();
    }

    @Test
    void posicaoDentroDaSegundaZonaRetornaAZonaCerta() {
        comZonasSeedadas();

        assertThat(localizadorZona.zonaContendo(6, 1)).contains(reuniao);
    }

    @Test
    void semMapaAtivoLancaRecursoNaoEncontrado() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> localizadorZona.zonaContendo(0, 0)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void asZonasSaoConsultadasSoUmaVez() {
        comZonasSeedadas();

        localizadorZona.zonaContendo(1, 1);
        localizadorZona.zonaContendo(6, 1);
        localizadorZona.zonaContendo(8, 8);

        verify(zonaRepository, times(1)).findByMapa(mapa);
    }
}
