package io.escritor.presenca.ponto.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.domain.OrigemApontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JornadaServiceTest {

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    @Mock
    private ApontamentoRepository apontamentoRepository;

    @Mock
    private VisibilidadeUsuarioService visibilidadeUsuarioService;

    private final Usuario usuario = usuarioComId(1L, 480);
    private final Card card = cardComId(5L);

    private JornadaService jornadaService;

    private static Usuario usuarioComId(Long id, int cargaDiariaMinutos) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, cargaDiariaMinutos);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Card cardComId(Long id) {
        Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuarioComId(1L, 480));
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    private RegistroPonto registro(TipoRegistroPonto tipo, String isoInstant) {
        return registro(usuario, tipo, isoInstant);
    }

    private static RegistroPonto registro(Usuario usuarioDoRegistro, TipoRegistroPonto tipo, String isoInstant) {
        return new RegistroPonto(
                usuarioDoRegistro, tipo, Instant.parse(isoInstant), OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
    }

    @BeforeEach
    void setUp() {
        // terça-feira 2026-01-13, 20h - já bateu entrada e saída hoje
        Clock clock = Clock.fixed(Instant.parse("2026-01-13T20:00:00Z"), ZoneOffset.UTC);
        jornadaService = new JornadaService(registroPontoRepository, apontamentoRepository, visibilidadeUsuarioService, clock);
        // stub padrão pra não obrigar todo teste a mockar apontamentos - só sobrescrito nos testes
        // que exercitam totalApontadoMinutos de verdade.
        lenient()
                .when(apontamentoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(any(), any(), any()))
                .thenReturn(List.of());
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
        assertThat(jornada.totalApontadoMinutos()).isZero();
    }

    @Test
    void totalApontadoMinutosSomaSoOsApontamentosFechadosDoDia() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any())).thenReturn(List.of());
        Apontamento fechado1 = new Apontamento(
                usuario, card, Instant.parse("2026-01-13T09:00:00Z"), Instant.parse("2026-01-13T10:00:00Z"), null, OrigemApontamento.MANUAL);
        Apontamento fechado2 = new Apontamento(
                usuario, card, Instant.parse("2026-01-13T11:00:00Z"), Instant.parse("2026-01-13T11:30:00Z"), null, OrigemApontamento.MANUAL);
        when(apontamentoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
                        usuario, Instant.parse("2026-01-13T00:00:00Z"), Instant.parse("2026-01-14T00:00:00Z")))
                .thenReturn(List.of(fechado1, fechado2));

        var jornada = jornadaService.jornadaDoDia(usuario);

        assertThat(jornada.totalApontadoMinutos()).isEqualTo(90);
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
    void segundosTrabalhadosAteAgoraContaOSegmentoEmAndamento() {
        // clock fixo do setUp: 2026-01-13T20:00:00Z - entrada foi às 09:00, então 11h de trabalho
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(any(), any()))
                .thenReturn(List.of(registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z")));

        assertThat(jornadaService.segundosTrabalhadosAteAgora(usuario)).isEqualTo(11 * 3600);
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

    @Test
    void jornadaDoDiaComUsuarioIdNuloUsaOProprioRequisitante() {
        when(visibilidadeUsuarioService.resolverAlvo(isNull(), eq(usuario), any())).thenReturn(usuario);
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(eq(usuario), any())).thenReturn(List.of());

        var jornada = jornadaService.jornadaDoDia(null, usuario);

        assertThat(jornada.minutosTrabalhados()).isZero();
    }

    @Test
    void jornadaDoDiaComUsuarioIdUsaOAlvoResolvidoInclusiveACargaDiariaDele() {
        // carga do alvo (360) é diferente da do requisitante (480, campo `usuario`) - prova que o
        // saldo é calculado com os dados de quem está sendo consultado, não de quem consulta.
        Usuario alvo = usuarioComId(3L, 360);
        when(visibilidadeUsuarioService.resolverAlvo(eq(3L), eq(usuario), any())).thenReturn(alvo);
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(eq(alvo), any()))
                .thenReturn(List.of(
                        registro(alvo, TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z"),
                        registro(alvo, TipoRegistroPonto.SAIDA, "2026-01-13T15:00:00Z")));

        var jornada = jornadaService.jornadaDoDia(3L, usuario);

        assertThat(jornada.minutosTrabalhados()).isEqualTo(6 * 60);
        assertThat(jornada.saldoDia()).isZero();
    }

    @Test
    void jornadaDoDiaPropagaExcecaoDeAcessoNegadoDaVisibilidade() {
        when(visibilidadeUsuarioService.resolverAlvo(eq(2L), eq(usuario), any())).thenThrow(new JornadaDeOutroUsuarioException());

        assertThatThrownBy(() -> jornadaService.jornadaDoDia(2L, usuario)).isInstanceOf(JornadaDeOutroUsuarioException.class);
    }

    @Test
    void espelhoDoMesComUsuarioIdUsaOAlvoResolvido() {
        Usuario alvo = usuarioComId(3L, 480);
        when(visibilidadeUsuarioService.resolverAlvo(eq(3L), eq(usuario), any())).thenReturn(alvo);
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(eq(alvo), any()))
                .thenReturn(List.of(
                        registro(alvo, TipoRegistroPonto.ENTRADA, "2026-01-12T09:00:00Z"),
                        registro(alvo, TipoRegistroPonto.SAIDA, "2026-01-12T18:00:00Z")));

        var espelho = jornadaService.espelhoDoMes(3L, usuario);

        assertThat(espelho.dias()).hasSize(1);
    }

    @Test
    void diasInconsistentesRetornaSoOsDiasSemSaidaAposAVirada() {
        // terça-feira 2026-01-13, 20h (clock fixo do setUp) - "hoje" ainda não virou.
        Instant inicioDoPeriodo = Instant.parse("2026-01-10T00:00:00Z");
        Instant fimDoPeriodo = Instant.parse("2026-01-14T00:00:00Z");
        when(visibilidadeUsuarioService.resolverAlvo(isNull(), eq(usuario), any())).thenReturn(usuario);
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        usuario, inicioDoPeriodo, fimDoPeriodo))
                .thenReturn(List.of(
                        // 01-10: fechada (tem SAIDA) - não deve aparecer.
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-10T09:00:00Z"),
                        registro(TipoRegistroPonto.SAIDA, "2026-01-10T18:00:00Z"),
                        // 01-11: só ENTRADA, dia já virou - inconsistente.
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-11T09:00:00Z"),
                        // 01-12: só ENTRADA, dia já virou - inconsistente.
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-12T09:00:00Z"),
                        // 01-13 (hoje, 20h): só ENTRADA, mas o dia ainda não virou - aberta, não inconsistente.
                        registro(TipoRegistroPonto.ENTRADA, "2026-01-13T09:00:00Z")));

        var dias = jornadaService.diasInconsistentes(null, inicioDoPeriodo, fimDoPeriodo, usuario);

        assertThat(dias).containsExactly(LocalDate.parse("2026-01-11"), LocalDate.parse("2026-01-12"));
    }

    @Test
    void diasInconsistentesComUsuarioIdUsaOAlvoResolvido() {
        Usuario alvo = usuarioComId(3L, 480);
        Instant inicioDoPeriodo = Instant.parse("2026-01-10T00:00:00Z");
        Instant fimDoPeriodo = Instant.parse("2026-01-14T00:00:00Z");
        when(visibilidadeUsuarioService.resolverAlvo(eq(3L), eq(usuario), any())).thenReturn(alvo);
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        alvo, inicioDoPeriodo, fimDoPeriodo))
                .thenReturn(List.of(registro(alvo, TipoRegistroPonto.ENTRADA, "2026-01-11T09:00:00Z")));

        var dias = jornadaService.diasInconsistentes(3L, inicioDoPeriodo, fimDoPeriodo, usuario);

        assertThat(dias).containsExactly(LocalDate.parse("2026-01-11"));
    }

    @Test
    void diasInconsistentesPropagaExcecaoDeAcessoNegadoDaVisibilidade() {
        when(visibilidadeUsuarioService.resolverAlvo(eq(2L), eq(usuario), any())).thenThrow(new JornadaDeOutroUsuarioException());

        assertThatThrownBy(() -> jornadaService.diasInconsistentes(
                        2L, Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-02-01T00:00:00Z"), usuario))
                .isInstanceOf(JornadaDeOutroUsuarioException.class);
    }
}
