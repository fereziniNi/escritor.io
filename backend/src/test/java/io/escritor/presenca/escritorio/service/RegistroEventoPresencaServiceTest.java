package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.EventoPresenca;
import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.repository.EventoPresencaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistroEventoPresencaServiceTest {

    @Mock
    private EventoPresencaRepository eventoPresencaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private ZonaRepository zonaRepository;

    @Captor
    private ArgumentCaptor<EventoPresenca> eventoCaptor;

    private RegistroEventoPresencaService registroEventoPresencaService;

    private final Mapa mapa = new Mapa("Escritório", 20, 15, "{}", true);
    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Zona foco = new Zona(mapa, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO);

    @BeforeEach
    void setUp() {
        registroEventoPresencaService = new RegistroEventoPresencaService(eventoPresencaRepository, usuarioRepository, zonaRepository);
        ReflectionTestUtils.setField(usuario, "id", 1L);
        ReflectionTestUtils.setField(foco, "id", 10L);
    }

    @Test
    void entrarNumaZonaAbreUmNovoEventoDePresenca() {
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
        when(zonaRepository.findById(10L)).thenReturn(Optional.of(foco));
        Instant agora = Instant.parse("2026-01-15T12:00:00Z");

        registroEventoPresencaService.registrarTransicaoDeZona(1L, null, 10L, agora);

        verify(eventoPresencaRepository).save(eventoCaptor.capture());
        assertThat(eventoCaptor.getValue().getUsuario()).isSameAs(usuario);
        assertThat(eventoCaptor.getValue().getZona()).isSameAs(foco);
        assertThat(eventoCaptor.getValue().getEntrouEm()).isEqualTo(agora);
        assertThat(eventoCaptor.getValue().getSaiuEm()).isNull();
    }

    @Test
    void sairDeUmaZonaEncerraOEventoAbertoDaquelaZona() {
        EventoPresenca eventoAberto = new EventoPresenca(usuario, foco, Instant.parse("2026-01-15T11:00:00Z"));
        when(eventoPresencaRepository.findFirstByUsuarioIdAndZonaIdAndSaiuEmIsNull(1L, 10L)).thenReturn(Optional.of(eventoAberto));
        Instant agora = Instant.parse("2026-01-15T12:00:00Z");

        registroEventoPresencaService.registrarTransicaoDeZona(1L, 10L, null, agora);

        verify(eventoPresencaRepository).save(eventoAberto);
        assertThat(eventoAberto.getSaiuEm()).isEqualTo(agora);
    }

    @Test
    void andarDiretoDeUmaZonaPraOutraEncerraAAntigaEAbreANova() {
        EventoPresenca eventoAberto = new EventoPresenca(usuario, foco, Instant.parse("2026-01-15T11:00:00Z"));
        when(eventoPresencaRepository.findFirstByUsuarioIdAndZonaIdAndSaiuEmIsNull(1L, 10L)).thenReturn(Optional.of(eventoAberto));
        Zona reuniao = new Zona(mapa, "Sala de reunião", 5, 0, 5, 5, TipoZona.REUNIAO);
        ReflectionTestUtils.setField(reuniao, "id", 11L);
        when(usuarioRepository.findById(1L)).thenReturn(Optional.of(usuario));
        when(zonaRepository.findById(11L)).thenReturn(Optional.of(reuniao));
        Instant agora = Instant.parse("2026-01-15T12:00:00Z");

        registroEventoPresencaService.registrarTransicaoDeZona(1L, 10L, 11L, agora);

        verify(eventoPresencaRepository, times(2)).save(any());
        assertThat(eventoAberto.getSaiuEm()).isEqualTo(agora);
    }

    @Test
    void semZonaAnteriorNemZonaNovaNaoFazNadaNoBanco() {
        registroEventoPresencaService.registrarTransicaoDeZona(1L, null, null, Instant.now());

        verify(eventoPresencaRepository, never()).save(any());
    }

    @Test
    void naoHaEventoAbertoParaEncerrarNaoQuebra() {
        when(eventoPresencaRepository.findFirstByUsuarioIdAndZonaIdAndSaiuEmIsNull(1L, 10L)).thenReturn(Optional.empty());

        registroEventoPresencaService.registrarTransicaoDeZona(1L, 10L, null, Instant.now());

        verify(eventoPresencaRepository, never()).save(any());
    }
}
