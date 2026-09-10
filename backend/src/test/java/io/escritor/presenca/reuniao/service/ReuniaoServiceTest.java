package io.escritor.presenca.reuniao.service;

import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.googlecalendar.service.GoogleMeetService;
import io.escritor.presenca.googlecalendar.service.GoogleOAuthService;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import io.escritor.presenca.reuniao.web.CriarReuniaoRequest;
import io.escritor.presenca.reuniao.web.ReuniaoResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReuniaoServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-15T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate DIA = LocalDate.of(2026, 1, 5);
    private static final String LINK_MEET = "https://meet.google.com/abc-defg-hij";

    @Mock
    private ReuniaoRepository reuniaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EscalaService escalaService;

    @Mock
    private VisibilidadeUsuarioService visibilidadeUsuarioService;

    @Mock
    private GoogleOAuthService googleOAuthService;

    @Mock
    private GoogleMeetService googleMeetService;

    @Mock
    private PresencaWebSocketHandler presencaWebSocketHandler;

    @Mock
    private NotificacaoService notificacaoService;

    private final Usuario criador = usuarioComId(1L, Papel.COLABORADOR);
    private final Usuario participante = usuarioComId(2L, Papel.COLABORADOR);

    private ReuniaoService reuniaoService;

    private static Usuario usuarioComId(Long id, Papel papel) {
        Usuario usuario = new Usuario("Ana Souza", "ana" + id + "@escritor.io", papel, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @BeforeEach
    void setUp() {
        reuniaoService = new ReuniaoService(reuniaoRepository, usuarioRepository, escalaService, visibilidadeUsuarioService,
                googleOAuthService, googleMeetService, presencaWebSocketHandler, notificacaoService, RELOGIO_FIXO);
    }

    private CriarReuniaoRequest requestPadrao() {
        return new CriarReuniaoRequest(List.of(participante.getId()), DIA, LocalTime.of(14, 30), LocalTime.of(15, 0), "Reunião de alinhamento");
    }

    private void mockarConectadoEExistente() {
        when(googleOAuthService.estaConectado(criador)).thenReturn(true);
        when(usuarioRepository.findAllById(List.of(participante.getId()))).thenReturn(List.of(participante));
    }

    @Test
    void criaAReuniaoQuandoOIntervaloEstaDentroDoExpedienteEfetivo() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA))
                .thenReturn(List.of(new DiaEfetivoResponse(DIA, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        when(reuniaoRepository.findByParticipantes_UsuarioAndData(participante, DIA)).thenReturn(List.of());
        when(reuniaoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(googleMeetService.criarEventoComMeet(eq(criador), any())).thenReturn(LINK_MEET);

        ReuniaoResponse resultado = reuniaoService.criar(criador, requestPadrao());

        assertThat(resultado.horaInicio()).isEqualTo(LocalTime.of(14, 30));
        assertThat(resultado.horaFim()).isEqualTo(LocalTime.of(15, 0));
        assertThat(resultado.titulo()).isEqualTo("Reunião de alinhamento");
        assertThat(resultado.linkMeet()).isEqualTo(LINK_MEET);
        assertThat(resultado.participantes()).extracting(ReuniaoResponse.ParticipanteResponse::id).containsExactly(participante.getId());
        verify(presencaWebSocketHandler).avisarConvite(eq(participante.getId()), any());
        // pedido do usuário: "ver as últimas que chegaram no sistema" - o convite também vira uma
        // notificação persistida, com o link do Meet pro item poder abrir direto.
        verify(notificacaoService).registrar(eq(participante), eq(TipoNotificacao.CONVITE_REUNIAO), any(), eq(LINK_MEET));
    }

    @Test
    void rejeitaQuandoOCriadorNaoConectouOGoogle() {
        when(googleOAuthService.estaConectado(criador)).thenReturn(false);

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(GoogleNaoConectadoException.class);
        verify(reuniaoRepository, never()).save(any());
    }

    @Test
    void rejeitaQuandoUmParticipanteNaoExiste() {
        when(googleOAuthService.estaConectado(criador)).thenReturn(true);
        when(usuarioRepository.findAllById(List.of(participante.getId()))).thenReturn(List.of());

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void rejeitaQuandoOParticipanteNaoTrabalhaNesseDia() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA)).thenReturn(List.of(new DiaEfetivoResponse(DIA, false, null, null)));

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(HorarioInvalidoException.class);
        verify(reuniaoRepository, never()).save(any());
    }

    @Test
    void rejeitaQuandoOIntervaloComecaAntesDoExpediente() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA))
                .thenReturn(List.of(new DiaEfetivoResponse(DIA, true, LocalTime.of(15, 0), LocalTime.of(18, 0))));

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(HorarioInvalidoException.class);
    }

    @Test
    void rejeitaQuandoOIntervaloTerminaDepoisDoExpediente() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA))
                .thenReturn(List.of(new DiaEfetivoResponse(DIA, true, LocalTime.of(9, 0), LocalTime.of(14, 45))));

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(HorarioInvalidoException.class);
    }

    @Test
    void rejeitaQuandoSobrepoeUmaReuniaoJaMarcada() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA))
                .thenReturn(List.of(new DiaEfetivoResponse(DIA, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        Reuniao existente = new Reuniao(criador, List.of(participante), DIA, LocalTime.of(14, 0), LocalTime.of(14, 45), "Já marcada",
                Instant.now());
        when(reuniaoRepository.findByParticipantes_UsuarioAndData(participante, DIA)).thenReturn(List.of(existente));

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(HorarioInvalidoException.class);
        verify(reuniaoRepository, never()).save(any());
    }

    @Test
    void naoSalvaSeAChamadaAoMeetFalhar() {
        mockarConectadoEExistente();
        when(escalaService.calcularEfetiva(participante, DIA, DIA))
                .thenReturn(List.of(new DiaEfetivoResponse(DIA, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        when(reuniaoRepository.findByParticipantes_UsuarioAndData(participante, DIA)).thenReturn(List.of());
        when(reuniaoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(googleMeetService.criarEventoComMeet(eq(criador), any())).thenThrow(new RuntimeException("Google fora do ar"));

        assertThatThrownBy(() -> reuniaoService.criar(criador, requestPadrao())).isInstanceOf(RuntimeException.class);
        verify(presencaWebSocketHandler, never()).avisarConvite(any(), any());
    }

    @Test
    void removerSoFuncionaParaQuemCriou() {
        Reuniao reuniao = new Reuniao(criador, List.of(participante), DIA, LocalTime.of(14, 30), LocalTime.of(15, 0), "Alinhamento",
                Instant.now());
        ReflectionTestUtils.setField(reuniao, "id", 10L);
        when(reuniaoRepository.findByIdAndCriador(10L, criador)).thenReturn(Optional.of(reuniao));

        reuniaoService.remover(criador, 10L);

        verify(reuniaoRepository).delete(reuniao);
        verify(googleMeetService).removerEvento(criador, 10L);
    }

    @Test
    void removerDeQuemNaoCriouLancaRecursoNaoEncontrado() {
        when(reuniaoRepository.findByIdAndCriador(10L, criador)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reuniaoService.remover(criador, 10L)).isInstanceOf(RecursoNaoEncontradoException.class);
        verify(googleMeetService, never()).removerEvento(any(), any());
    }

    @Test
    void removerContinuaMesmoQuandoAGoogleFalha() {
        Reuniao reuniao = new Reuniao(criador, List.of(participante), DIA, LocalTime.of(14, 30), LocalTime.of(15, 0), "Alinhamento",
                Instant.now());
        ReflectionTestUtils.setField(reuniao, "id", 10L);
        when(reuniaoRepository.findByIdAndCriador(10L, criador)).thenReturn(Optional.of(reuniao));
        org.mockito.Mockito.doThrow(new RuntimeException("Google fora do ar")).when(googleMeetService).removerEvento(criador, 10L);

        reuniaoService.remover(criador, 10L); // não deve lançar

        verify(reuniaoRepository).delete(reuniao);
    }

    @Test
    void listarMinhasJuntaCriadasEConvidadaSemDuplicar() {
        Reuniao criada = new Reuniao(criador, List.of(participante), DIA, LocalTime.of(9, 0), LocalTime.of(10, 0), "Criada por mim",
                Instant.now());
        ReflectionTestUtils.setField(criada, "id", 1L);
        when(reuniaoRepository.findByCriadorAndDataBetween(criador, DIA, DIA)).thenReturn(List.of(criada));
        when(reuniaoRepository.findByParticipantes_UsuarioAndDataBetween(criador, DIA, DIA)).thenReturn(List.of());

        List<ReuniaoResponse> resultado = reuniaoService.listarMinhas(criador, DIA, DIA);

        assertThat(resultado).extracting(ReuniaoResponse::id).containsExactly(1L);
    }
}
