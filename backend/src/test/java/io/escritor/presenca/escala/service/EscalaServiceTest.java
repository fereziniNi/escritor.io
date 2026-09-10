package io.escritor.presenca.escala.service;

import io.escritor.presenca.escala.domain.EscalaExcecao;
import io.escritor.presenca.escala.domain.EscalaSemanal;
import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.escala.repository.EscalaExcecaoRepository;
import io.escritor.presenca.escala.repository.EscalaSemanalRepository;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.escala.web.DisponibilidadeResponse;
import io.escritor.presenca.escala.web.EscalaEquipeResponse;
import io.escritor.presenca.escala.web.EscalaExcecaoResponse;
import io.escritor.presenca.escala.web.EscalaSemanalResponse;
import io.escritor.presenca.escala.web.ItemEscalaSemanalRequest;
import io.escritor.presenca.escala.web.SalvarExcecaoRequest;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EscalaServiceTest {

    @Mock
    private EscalaSemanalRepository escalaSemanalRepository;

    @Mock
    private EscalaExcecaoRepository escalaExcecaoRepository;

    @Mock
    private VisibilidadeUsuarioService visibilidadeUsuarioService;

    @Mock
    private UsuarioRepository usuarioRepository;

    private final Usuario usuario = usuarioComId(1L);

    private EscalaService escalaService;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @BeforeEach
    void setUp() {
        escalaService =
                new EscalaService(escalaSemanalRepository, escalaExcecaoRepository, visibilidadeUsuarioService, usuarioRepository);
    }

    @Test
    void listarSemanalOrdenaPorDiaDaSemana() {
        EscalaSemanal sexta = new EscalaSemanal(usuario, DayOfWeek.FRIDAY, LocalTime.of(9, 0), LocalTime.of(18, 0));
        EscalaSemanal segunda = new EscalaSemanal(usuario, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0));
        when(escalaSemanalRepository.findByUsuario(usuario)).thenReturn(List.of(sexta, segunda));

        List<EscalaSemanalResponse> resultado = escalaService.listarSemanal(usuario);

        assertThat(resultado).extracting(EscalaSemanalResponse::diaSemana)
                .containsExactly(DayOfWeek.MONDAY, DayOfWeek.FRIDAY);
    }

    @Test
    void definirSemanalSubstituiTudoOQueJaExistia() {
        List<ItemEscalaSemanalRequest> itens = List.of(
                new ItemEscalaSemanalRequest(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0)));
        when(escalaSemanalRepository.saveAll(any())).thenAnswer(chamada -> chamada.getArgument(0));

        escalaService.definirSemanal(usuario, itens);

        verify(escalaSemanalRepository).deleteByUsuario(usuario);
        verify(escalaSemanalRepository).flush();
        verify(escalaSemanalRepository).saveAll(any());
    }

    @Test
    void definirSemanalRejeitaDiaDaSemanaRepetido() {
        List<ItemEscalaSemanalRequest> itens = List.of(
                new ItemEscalaSemanalRequest(DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(12, 0)),
                new ItemEscalaSemanalRequest(DayOfWeek.MONDAY, LocalTime.of(14, 0), LocalTime.of(18, 0)));

        assertThatThrownBy(() -> escalaService.definirSemanal(usuario, itens)).isInstanceOf(HorarioInvalidoException.class);
    }

    @Test
    void listarExcecoesRejeitaFimAntesDoInicio() {
        assertThatThrownBy(() -> escalaService.listarExcecoes(usuario, LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 1)))
                .isInstanceOf(HorarioInvalidoException.class);
    }

    @Test
    void calcularEfetivaRejeitaIntervaloGrandeDemais() {
        LocalDate inicio = LocalDate.of(2026, 1, 1);
        LocalDate fim = inicio.plusDays(400);

        assertThatThrownBy(() -> escalaService.calcularEfetiva(usuario, inicio, fim)).isInstanceOf(HorarioInvalidoException.class);
    }

    @Test
    void salvarExcecaoCriaNovaQuandoNaoExisteParaADataAinda() {
        SalvarExcecaoRequest request = new SalvarExcecaoRequest(
                LocalDate.of(2026, 1, 5), true, LocalTime.of(8, 0), LocalTime.of(12, 0), "Plantão");
        when(escalaExcecaoRepository.findByUsuarioAndData(usuario, request.data())).thenReturn(Optional.empty());
        when(escalaExcecaoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        EscalaExcecaoResponse resultado = escalaService.salvarExcecao(usuario, request);

        assertThat(resultado.data()).isEqualTo(request.data());
        assertThat(resultado.trabalha()).isTrue();
        assertThat(resultado.horaInicio()).isEqualTo(LocalTime.of(8, 0));
    }

    @Test
    void salvarExcecaoAtualizaAExistenteNaMesmaData() {
        EscalaExcecao existente = new EscalaExcecao(
                usuario, LocalDate.of(2026, 1, 5), true, LocalTime.of(8, 0), LocalTime.of(12, 0), null);
        SalvarExcecaoRequest request = new SalvarExcecaoRequest(LocalDate.of(2026, 1, 5), false, null, null, "Folga");
        when(escalaExcecaoRepository.findByUsuarioAndData(usuario, request.data())).thenReturn(Optional.of(existente));
        when(escalaExcecaoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        EscalaExcecaoResponse resultado = escalaService.salvarExcecao(usuario, request);

        assertThat(resultado.trabalha()).isFalse();
        assertThat(resultado.horaInicio()).isNull();
        assertThat(resultado.observacao()).isEqualTo("Folga");
    }

    @Test
    void removerExcecaoInexistenteOuDeOutroUsuarioLancaRecursoNaoEncontrado() {
        when(escalaExcecaoRepository.findByIdAndUsuario(99L, usuario)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> escalaService.removerExcecao(usuario, 99L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void calcularEfetivaPriorizaExcecaoSobreOPadraoSemanal() {
        LocalDate segundaFeira = LocalDate.of(2026, 1, 5); // uma segunda-feira
        EscalaSemanal padraoSegunda = new EscalaSemanal(usuario, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0));
        EscalaExcecao excecao = new EscalaExcecao(usuario, segundaFeira, true, LocalTime.of(7, 0), LocalTime.of(11, 0), null);
        when(escalaSemanalRepository.findByUsuario(usuario)).thenReturn(List.of(padraoSegunda));
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(usuario, segundaFeira, segundaFeira))
                .thenReturn(List.of(excecao));

        List<DiaEfetivoResponse> resultado = escalaService.calcularEfetiva(usuario, segundaFeira, segundaFeira);

        assertThat(resultado).containsExactly(new DiaEfetivoResponse(segundaFeira, true, LocalTime.of(7, 0), LocalTime.of(11, 0)));
    }

    @Test
    void calcularEfetivaExcecaoDeFolgaVenceOPadraoQueTrabalhariaNesseDia() {
        LocalDate segundaFeira = LocalDate.of(2026, 1, 5);
        EscalaSemanal padraoSegunda = new EscalaSemanal(usuario, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0));
        EscalaExcecao folga = new EscalaExcecao(usuario, segundaFeira, false, null, null, "Feriado");
        when(escalaSemanalRepository.findByUsuario(usuario)).thenReturn(List.of(padraoSegunda));
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(usuario, segundaFeira, segundaFeira))
                .thenReturn(List.of(folga));

        List<DiaEfetivoResponse> resultado = escalaService.calcularEfetiva(usuario, segundaFeira, segundaFeira);

        assertThat(resultado).containsExactly(new DiaEfetivoResponse(segundaFeira, false, null, null));
    }

    @Test
    void calcularEfetivaSemExcecaoUsaOPadraoSemanalDoDia() {
        LocalDate segundaFeira = LocalDate.of(2026, 1, 5);
        EscalaSemanal padraoSegunda = new EscalaSemanal(usuario, DayOfWeek.MONDAY, LocalTime.of(9, 0), LocalTime.of(18, 0));
        when(escalaSemanalRepository.findByUsuario(usuario)).thenReturn(List.of(padraoSegunda));
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(usuario, segundaFeira, segundaFeira)).thenReturn(List.of());

        List<DiaEfetivoResponse> resultado = escalaService.calcularEfetiva(usuario, segundaFeira, segundaFeira);

        assertThat(resultado).containsExactly(new DiaEfetivoResponse(segundaFeira, true, LocalTime.of(9, 0), LocalTime.of(18, 0)));
    }

    @Test
    void calcularEfetivaSemPadraoNemExcecaoNaoTrabalha() {
        LocalDate sabado = LocalDate.of(2026, 1, 10);
        when(escalaSemanalRepository.findByUsuario(usuario)).thenReturn(List.of());
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(usuario, sabado, sabado)).thenReturn(List.of());

        List<DiaEfetivoResponse> resultado = escalaService.calcularEfetiva(usuario, sabado, sabado);

        assertThat(resultado).containsExactly(new DiaEfetivoResponse(sabado, false, null, null));
    }

    @Test
    void calcularEfetivaDaEquipeUsaOsUsuariosVisiveisDoRequisitante() {
        LocalDate dia = LocalDate.of(2026, 1, 5);
        Usuario colega = usuarioComId(2L);
        when(visibilidadeUsuarioService.listarUsuariosVisiveis(usuario)).thenReturn(List.of(usuario, colega));
        when(escalaSemanalRepository.findByUsuario(any())).thenReturn(List.of());
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(any(), any(), any())).thenReturn(List.of());

        List<EscalaEquipeResponse> resultado = escalaService.calcularEfetivaDaEquipe(usuario, dia, dia);

        assertThat(resultado).extracting(EscalaEquipeResponse::usuarioId).containsExactly(1L, 2L);
    }

    @Test
    void consultarDisponibilidadeDevolveUmItemPorUsuarioComOCalculoEfetivoDaData() {
        LocalDate quinta = LocalDate.of(2026, 9, 10);
        Usuario semExpediente = usuarioComId(6L);
        when(usuarioRepository.findAllById(List.of(1L, 6L))).thenReturn(List.of(usuario, semExpediente));
        when(escalaSemanalRepository.findByUsuario(usuario))
                .thenReturn(List.of(new EscalaSemanal(usuario, DayOfWeek.THURSDAY, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        when(escalaSemanalRepository.findByUsuario(semExpediente)).thenReturn(List.of());
        when(escalaExcecaoRepository.findByUsuarioAndDataBetween(any(), eq(quinta), eq(quinta))).thenReturn(List.of());

        List<DisponibilidadeResponse> resultado = escalaService.consultarDisponibilidade(List.of(1L, 6L), quinta);

        assertThat(resultado).containsExactly(
                new DisponibilidadeResponse(1L, "Ana Souza", true, LocalTime.of(9, 0), LocalTime.of(18, 0)),
                new DisponibilidadeResponse(6L, "Ana Souza", false, null, null));
    }
}
