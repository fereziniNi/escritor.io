package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
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
class ValidadorPosicaoMapaTest {

    @Mock
    private MapaRepository mapaRepository;

    private ValidadorPosicaoMapa validadorPosicaoMapa;

    @BeforeEach
    void setUp() {
        validadorPosicaoMapa = new ValidadorPosicaoMapa(mapaRepository);
    }

    @Test
    void posicaoDentroDosLimitesEValida() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(new Mapa("Escritório", 20, 15, "{}", true)));

        assertThat(validadorPosicaoMapa.dentroDosLimites(10, 7)).isTrue();
    }

    @Test
    void posicaoNaOrigemEValida() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(new Mapa("Escritório", 20, 15, "{}", true)));

        assertThat(validadorPosicaoMapa.dentroDosLimites(0, 0)).isTrue();
    }

    @Test
    void posicaoNoLimiteExatoEInvalida() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(new Mapa("Escritório", 20, 15, "{}", true)));

        assertThat(validadorPosicaoMapa.dentroDosLimites(20, 0)).isFalse();
        assertThat(validadorPosicaoMapa.dentroDosLimites(0, 15)).isFalse();
    }

    @Test
    void posicaoNegativaEInvalida() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(new Mapa("Escritório", 20, 15, "{}", true)));

        assertThat(validadorPosicaoMapa.dentroDosLimites(-1, 0)).isFalse();
        assertThat(validadorPosicaoMapa.dentroDosLimites(0, -1)).isFalse();
    }

    @Test
    void semMapaAtivoLancaRecursoNaoEncontrado() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> validadorPosicaoMapa.dentroDosLimites(0, 0)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void limitesDoMapaAtivoSaoConsultadosSoUmaVez() {
        when(mapaRepository.findFirstByAtivoTrue()).thenReturn(Optional.of(new Mapa("Escritório", 20, 15, "{}", true)));

        validadorPosicaoMapa.dentroDosLimites(1, 1);
        validadorPosicaoMapa.dentroDosLimites(2, 2);
        validadorPosicaoMapa.dentroDosLimites(3, 3);

        verify(mapaRepository, times(1)).findFirstByAtivoTrue();
    }
}
