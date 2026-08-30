package io.escritor.presenca.escritorio.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MapaTest {

    @Test
    void mapaValido() {
        Mapa mapa = new Mapa("Escritório", 20, 15, "{\"paredes\": []}", true);

        assertThat(mapa.getNome()).isEqualTo("Escritório");
        assertThat(mapa.getLarguraTiles()).isEqualTo(20);
        assertThat(mapa.getAlturaTiles()).isEqualTo(15);
        assertThat(mapa.getLayoutJson()).isEqualTo("{\"paredes\": []}");
        assertThat(mapa.isAtivo()).isTrue();
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Mapa("   ", 20, 15, "{}", true))
                .isInstanceOf(NomeMapaObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Mapa(null, 20, 15, "{}", true))
                .isInstanceOf(NomeMapaObrigatorioException.class);
    }

    @Test
    void larguraZeroLancaExcecao() {
        assertThatThrownBy(() -> new Mapa("Escritório", 0, 15, "{}", true))
                .isInstanceOf(DimensaoMapaInvalidaException.class);
    }

    @Test
    void alturaNegativaLancaExcecao() {
        assertThatThrownBy(() -> new Mapa("Escritório", 20, -1, "{}", true))
                .isInstanceOf(DimensaoMapaInvalidaException.class);
    }

    @Test
    void layoutJsonEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Mapa("Escritório", 20, 15, "   ", true))
                .isInstanceOf(LayoutJsonObrigatorioException.class);
    }

    @Test
    void layoutJsonNuloLancaExcecao() {
        assertThatThrownBy(() -> new Mapa("Escritório", 20, 15, null, true))
                .isInstanceOf(LayoutJsonObrigatorioException.class);
    }
}
