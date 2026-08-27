package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PontoServiceTest {

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    private final Usuario usuario = usuarioComId(1L);
    private final Instant agora = Instant.parse("2026-01-15T12:00:00Z");
    private final Clock clock = Clock.fixed(agora, ZoneOffset.UTC);

    private PontoService pontoService;

    @BeforeEach
    void setUp() {
        pontoService = new PontoService(registroPontoRepository, clock);
    }

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @Test
    void primeiraMarcacaoDoUsuarioSoAceitaEntrada() {
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.empty());
        when(registroPontoRepository.save(any(RegistroPonto.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = pontoService.marcar(usuario, TipoRegistroPonto.ENTRADA, "127.0.0.1", "junit");

        assertThat(resposta.tipo()).isEqualTo(TipoRegistroPonto.ENTRADA);
        assertThat(resposta.momento()).isEqualTo(agora);
    }

    @Test
    void momentoVemSempreDoRelogioDoServidor() {
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.empty());
        when(registroPontoRepository.save(any(RegistroPonto.class))).thenAnswer(chamada -> chamada.getArgument(0));

        pontoService.marcar(usuario, TipoRegistroPonto.ENTRADA, "127.0.0.1", "junit");

        var captor = org.mockito.ArgumentCaptor.forClass(RegistroPonto.class);
        verify(registroPontoRepository).save(captor.capture());
        assertThat(captor.getValue().getMomento()).isEqualTo(agora);
        assertThat(captor.getValue().getOrigem()).isEqualTo(OrigemRegistroPonto.WEB);
    }

    @Test
    void encadeiaComOHashDoUltimoRegistroDoUsuario() {
        RegistroPonto entradaAnterior = new RegistroPonto(
                usuario,
                TipoRegistroPonto.ENTRADA,
                agora.minusSeconds(3600),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                null);
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario))
                .thenReturn(Optional.of(entradaAnterior));
        when(registroPontoRepository.save(any(RegistroPonto.class))).thenAnswer(chamada -> chamada.getArgument(0));

        pontoService.marcar(usuario, TipoRegistroPonto.SAIDA, "127.0.0.1", "junit");

        var captor = org.mockito.ArgumentCaptor.forClass(RegistroPonto.class);
        verify(registroPontoRepository).save(captor.capture());
        assertThat(captor.getValue().getHashAnterior()).isEqualTo(entradaAnterior.getHash());
        assertThat(captor.getValue().hashValido()).isTrue();
    }

    @Test
    void sequenciaInvalidaERejeitadaSemSalvar() {
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pontoService.marcar(usuario, TipoRegistroPonto.SAIDA, "127.0.0.1", "junit"))
                .isInstanceOf(SequenciaInvalidaException.class);

        verify(registroPontoRepository, never()).save(any());
    }

    @Test
    void quemEstaEmPausaNaoConsegueSair() {
        RegistroPonto emPausa = new RegistroPonto(
                usuario, TipoRegistroPonto.PAUSA_INICIO, agora.minusSeconds(600), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario)).thenReturn(Optional.of(emPausa));

        assertThatThrownBy(() -> pontoService.marcar(usuario, TipoRegistroPonto.SAIDA, "127.0.0.1", "junit"))
                .isInstanceOf(SequenciaInvalidaException.class);
    }
}
