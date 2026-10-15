package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.MesInvalidoException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.FechamentoMesPessoaResponse;
import io.escritor.presenca.ponto.web.FechamentoMesResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FechamentoMesServiceTest {

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    private final Usuario ana = usuario(1L, "Ana Souza", 360, "2026-01-01T00:00:00Z");
    private final Usuario beto = usuario(2L, "Beto Lima", 480, "2026-01-01T00:00:00Z");

    private FechamentoMesService service;

    private static Usuario usuario(Long id, String nome, int cargaDiariaMinutos, String criadoEm) {
        Usuario usuario = new Usuario(nome, nome.toLowerCase().replace(' ', '.') + "@escritor.io", Papel.COLABORADOR, cargaDiariaMinutos);
        ReflectionTestUtils.setField(usuario, "id", id);
        ReflectionTestUtils.setField(usuario, "criadoEm", Instant.parse(criadoEm));
        return usuario;
    }

    private static RegistroPonto registro(Usuario usuario, TipoRegistroPonto tipo, String isoInstant) {
        return new RegistroPonto(usuario, tipo, Instant.parse(isoInstant), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
    }

    private static final Instant INICIO_JANEIRO = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant INICIO_FEVEREIRO = Instant.parse("2026-02-01T00:00:00Z");

    @BeforeEach
    void setUp() {
        // quarta-feira 2026-01-07, meio-dia
        Clock clock = Clock.fixed(Instant.parse("2026-01-07T12:00:00Z"), ZoneOffset.UTC);
        service = new FechamentoMesService(registroPontoRepository, usuarioRepository, clock);
    }

    @Test
    void somaHorasESaldoDeCadaPessoaNoMes() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));
        // Ana (carga 6h): seg 05/01 fez 7h (+1h), ter 06/01 fez 5h (-1h) -> saldo 0, 12h no total
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        eq(ana), eq(INICIO_JANEIRO), eq(INICIO_FEVEREIRO)))
                .thenReturn(List.of(
                        registro(ana, TipoRegistroPonto.ENTRADA, "2026-01-05T09:00:00Z"),
                        registro(ana, TipoRegistroPonto.SAIDA, "2026-01-05T16:00:00Z"),
                        registro(ana, TipoRegistroPonto.ENTRADA, "2026-01-06T09:00:00Z"),
                        registro(ana, TipoRegistroPonto.SAIDA, "2026-01-06T14:00:00Z")));
        // Beto (carga 8h): seg 05/01 fez 6h com 1h de pausa -> -2h
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        eq(beto), eq(INICIO_JANEIRO), eq(INICIO_FEVEREIRO)))
                .thenReturn(List.of(
                        registro(beto, TipoRegistroPonto.ENTRADA, "2026-01-05T08:00:00Z"),
                        registro(beto, TipoRegistroPonto.PAUSA_INICIO, "2026-01-05T12:00:00Z"),
                        registro(beto, TipoRegistroPonto.PAUSA_FIM, "2026-01-05T13:00:00Z"),
                        registro(beto, TipoRegistroPonto.SAIDA, "2026-01-05T15:00:00Z")));

        FechamentoMesResponse fechamento = service.fechamento(YearMonth.of(2026, 1));

        assertThat(fechamento.mes()).isEqualTo("2026-01");
        assertThat(fechamento.pessoas()).containsExactly(
                new FechamentoMesPessoaResponse(1L, "Ana Souza", 360, 2, 720, 0, 2, 0),
                new FechamentoMesPessoaResponse(2L, "Beto Lima", 480, 1, 360, -120, 3, 0));
    }

    @Test
    void contaDiasUteisSemMarcacaoSoAntesDeHojeEDepoisDoCadastro() {
        // cadastrada na terça 06/01: segunda 05/01 não é falta dela; 07/01 é hoje, ainda não conta
        Usuario novata = usuario(3L, "Carla Dias", 480, "2026-01-06T10:00:00Z");
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(novata));
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        eq(novata), eq(INICIO_JANEIRO), eq(INICIO_FEVEREIRO)))
                .thenReturn(List.of());

        FechamentoMesPessoaResponse linha = service.fechamento(YearMonth.of(2026, 1)).pessoas().get(0);

        assertThat(linha.diasUteisSemMarcacao()).isEqualTo(1);
        assertThat(linha.saldoMinutos()).isZero();
    }

    @Test
    void diaSemSaidaApareceComoInconsistenteENaoSomaHoras() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana));
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        eq(ana), eq(INICIO_JANEIRO), eq(INICIO_FEVEREIRO)))
                .thenReturn(List.of(
                        registro(ana, TipoRegistroPonto.ENTRADA, "2026-01-05T09:00:00Z"),
                        registro(ana, TipoRegistroPonto.PAUSA_INICIO, "2026-01-05T12:00:00Z")));

        FechamentoMesPessoaResponse linha = service.fechamento(YearMonth.of(2026, 1)).pessoas().get(0);

        assertThat(linha.diasInconsistentes()).isEqualTo(1);
        assertThat(linha.minutosTrabalhados()).isZero();
        assertThat(linha.diasTrabalhados()).isZero();
        assertThat(linha.saldoMinutos()).isEqualTo(-360);
    }

    @Test
    void mesNuloUsaOMesCorrente() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of());

        assertThat(service.fechamento(null).mes()).isEqualTo("2026-01");
    }

    @Test
    void mesFuturoERejeitado() {
        assertThatThrownBy(() -> service.fechamento(YearMonth.of(2026, 2))).isInstanceOf(MesInvalidoException.class);
    }
}
