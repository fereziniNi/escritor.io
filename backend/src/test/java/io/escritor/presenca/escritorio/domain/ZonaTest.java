package io.escritor.presenca.escritorio.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ZonaTest {

    private final Mapa mapa = new Mapa("Escritório", 20, 15, "{}", true);

    @Test
    void zonaValida() {
        Zona zona = new Zona(mapa, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO);

        assertThat(zona.getMapa()).isSameAs(mapa);
        assertThat(zona.getNome()).isEqualTo("Sala de foco");
        assertThat(zona.getX()).isZero();
        assertThat(zona.getY()).isZero();
        assertThat(zona.getLargura()).isEqualTo(4);
        assertThat(zona.getAltura()).isEqualTo(4);
        assertThat(zona.getTipo()).isEqualTo(TipoZona.FOCO);
    }

    @Test
    void zonaNoLimiteExatoDoMapaEValida() {
        Zona zona = new Zona(mapa, "Canto", 16, 11, 4, 4, TipoZona.LIVRE);

        assertThat(zona.getX()).isEqualTo(16);
        assertThat(zona.getY()).isEqualTo(11);
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "  ", 0, 0, 4, 4, TipoZona.FOCO))
                .isInstanceOf(NomeZonaObrigatorioException.class);
    }

    @Test
    void xNegativoLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "Sala", -1, 0, 4, 4, TipoZona.FOCO))
                .isInstanceOf(DimensaoZonaInvalidaException.class);
    }

    @Test
    void larguraZeroLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "Sala", 0, 0, 0, 4, TipoZona.FOCO))
                .isInstanceOf(DimensaoZonaInvalidaException.class);
    }

    @Test
    void tipoNuloLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "Sala", 0, 0, 4, 4, null))
                .isInstanceOf(TipoZonaObrigatorioException.class);
    }

    @Test
    void larguraUltrapassandoLimiteDoMapaLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "Sala", 18, 0, 4, 4, TipoZona.FOCO))
                .isInstanceOf(ZonaForaDosLimitesDoMapaException.class);
    }

    @Test
    void alturaUltrapassandoLimiteDoMapaLancaExcecao() {
        assertThatThrownBy(() -> new Zona(mapa, "Sala", 0, 13, 4, 4, TipoZona.FOCO))
                .isInstanceOf(ZonaForaDosLimitesDoMapaException.class);
    }
}
