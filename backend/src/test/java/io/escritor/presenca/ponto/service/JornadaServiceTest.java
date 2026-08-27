package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JornadaServiceTest {

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    private final Usuario usuario = usuarioComId(1L, 480);

    private JornadaService jornadaService;

    private static Usuario usuarioComId(Long id, int cargaDiariaMinutos) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, cargaDiariaMinutos);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private RegistroPonto registro(TipoRegistroPonto tipo, String isoInstant) {
        return new RegistroPonto(
                usuario, tipo, Instant.parse(isoInstant), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
    }

    @BeforeEach
    void setUp() {
        // terça-feira 2026-01-13, 20h - já bateu entrada e saída hoje
        Clock clock = Clock.fixed(Instant.parse("2026-01-13T20:00:00Z"), ZoneOffset.UTC);
        jornadaService = new JornadaService(registroPontoRepository, clock);
    }

    @Test
    void jornadaDeHojeFechadaComSaldoPositivo() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-13T18:00:00Z")));

        var jornada = jornadaService.jornadaDoDia(usuario);

        assertThat(jornada.estado()).isEqualTo(EstadoDia.FECHADA);
        assertThat(jornada.minutosTrabalhados()).isEqualTo(9 * 60);
        assertThat(jornada.saldoDia()).isEqualTo(60);
        assertThat(jornada.saldoAcumuladoNoPeriodo()).isEqualTo(60);
    }

    @Test
    void jornadaDeHojeAindaAbertaSemSaida() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z")));

        var jornada = jornadaService.jornadaDoDia(usuario);

        assertThat(jornada.estado()).isEqualTo(EstadoDia.ABERTA);
        assertThat(jornada.minutosTrabalhados()).isZero();
    }

    @Test
    void saldoAcumuladoSomaOsDiasUteisAnterioresEIgnoraFimDeSemana() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(
                        // segunda-feira 2026-01-12: trabalhou 9h (saldo +60)
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-12T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-12T18:00:00Z"),
                        // sábado 2026-01-10 (mesmo mês): trabalhou, mas não deveria contar
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-10T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-10T13:00:00Z"),
                        // hoje, terça-feira 2026-01-13: trabalhou 8h (saldo 0)
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-13T17:00:00Z")));

        var jornada = jornadaService.jornadaDoDia(usuario);

        assertThat(jornada.saldoAcumuladoNoPeriodo()).isEqualTo(60);
    }

    @Test
    void espelhoDoMesListaSoOsDiasComMarcacaoOrdenados() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-13T17:00:00Z"),
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-12T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-12T18:00:00Z")));

        var espelho = jornadaService.espelhoDoMes(usuario);

        assertThat(espelho.dias()).hasSize(2);
        assertThat(espelho.dias().get(0).data()).isEqualTo("2026-01-12");
        assertThat(espelho.dias().get(0).estado()).isEqualTo(EstadoDia.FECHADA);
        assertThat(espelho.dias().get(0).saldoDia()).isEqualTo(60);
        assertThat(espelho.dias().get(1).data()).isEqualTo("2026-01-13");
        assertThat(espelho.dias().get(1).saldoDia()).isZero();
    }

    @Test
    void espelhoDoMesIgnoraDiaSemNenhumaMarcacao() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of());

        var espelho = jornadaService.espelhoDoMes(usuario);

        assertThat(espelho.dias()).isEmpty();
        assertThat(espelho.saldoAcumuladoNoPeriodo()).isZero();
    }

    @Test
    void espelhoDoMesSomaDosDiasUteisBateComSaldoAcumulado() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(
                        // segunda-feira 2026-01-12: saldo +60
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-12T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-12T18:00:00Z"),
                        // sábado 2026-01-10: não deveria contar na soma
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-10T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-10T13:00:00Z"),
                        // hoje, terça-feira 2026-01-13: saldo 0
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-13T17:00:00Z")));

        var espelho = jornadaService.espelhoDoMes(usuario);

        long somaDiasUteis = espelho.dias().stream()
                .filter(dia -> {
                    var diaDaSemana = dia.data().getDayOfWeek();
                    return diaDaSemana != java.time.DayOfWeek.SATURDAY && diaDaSemana != java.time.DayOfWeek.SUNDAY;
                })
                .mapToLong(io.escritor.presenca.ponto.web.EspelhoDiaResponse::saldoDia)
                .sum();

        assertThat(somaDiasUteis).isEqualTo(espelho.saldoAcumuladoNoPeriodo());
        assertThat(espelho.saldoAcumuladoNoPeriodo()).isEqualTo(60);
    }
}
