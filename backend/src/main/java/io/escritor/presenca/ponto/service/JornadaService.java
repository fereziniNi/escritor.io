package io.escritor.presenca.ponto.service;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.apontamento.repository.ApontamentoRepository;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.domain.JornadaDiaria;
import io.escritor.presenca.ponto.domain.Marcacao;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SaldoAcumulado;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.EspelhoDiaResponse;
import io.escritor.presenca.ponto.web.EspelhoMesResponse;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Período (tanto de "saldo acumulado" quanto do espelho do mês, S2.14) é sempre mês corrente até
 * hoje (dia 1 às 00:00 UTC até agora) - período arbitrário/mês passado fica pra depois do MVP.
 * "Dia" é sempre o dia civil em UTC: o sistema ainda não tem noção de fuso horário da empresa
 * (ver ADR 0010).
 */
@Service
public class JornadaService {

    private final RegistroPontoRepository registroPontoRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;
    private final Clock clock;

    public JornadaService(
            RegistroPontoRepository registroPontoRepository,
            ApontamentoRepository apontamentoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService,
            Clock clock) {
        this.registroPontoRepository = registroPontoRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
        this.clock = clock;
    }

    /**
     * PRD §2: "gestor vê jornada e relatórios das suas equipes". Entrada pública usada pelo
     * controller (S5.2) - resolve/autoriza `usuarioId` via {@link VisibilidadeUsuarioService}
     * (S5.1) e delega pro cálculo de sempre ({@link #jornadaDoDia(Usuario)}), que continua sem
     * checar nada, só calculando pra quem for passado.
     */
    public JornadaDoDiaResponse jornadaDoDia(Long usuarioIdFiltro, Usuario usuarioAutenticado) {
        return jornadaDoDia(visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new));
    }

    /** Mesma ideia de {@link #jornadaDoDia(Long, Usuario)}, pro espelho do mês. */
    public EspelhoMesResponse espelhoDoMes(Long usuarioIdFiltro, Usuario usuarioAutenticado) {
        return espelhoDoMes(visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new));
    }

    /**
     * `totalApontadoMinutos` é um cálculo paralelo ao saldo de ponto (E1), nunca o altera - PRD
     * §3.4: apontamento é dado de gestão de card, não de jornada. Só soma apontamentos já
     * encerrados do dia; um timer ainda aberto não entra na soma (o frontend mostra ele separado,
     * S4.4/S4.9).
     */
    public JornadaDoDiaResponse jornadaDoDia(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = marcacoesPorDiaNoMesCorrente(usuario, hoje);

        List<Marcacao> marcacoesDeHoje = marcacoesPorDia.getOrDefault(hoje, List.of());
        Instant inicioDoDia = hoje.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant fimDoDia = hoje.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        EstadoDia estado = EstadoDia.calcular(marcacoesDeHoje, fimDoDia, agora);
        long minutosTrabalhados = JornadaDiaria.minutosTrabalhados(marcacoesDeHoje);
        long saldoDia = JornadaDiaria.saldo(marcacoesDeHoje, cargaDiariaMinutos);
        long saldoAcumuladoNoPeriodo = SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos);
        long totalApontadoMinutos = apontamentoRepository
                .findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, inicioDoDia, fimDoDia)
                .stream()
                .mapToLong(Apontamento::getMinutos)
                .sum();

        return new JornadaDoDiaResponse(hoje, estado, minutosTrabalhados, saldoDia, saldoAcumuladoNoPeriodo, totalApontadoMinutos);
    }

    /**
     * Só lista dias com pelo menos uma marcação - um dia sem nenhum registro não aparece (mesma
     * regra que {@link io.escritor.presenca.ponto.domain.SaldoAcumulado} já segue pro acumulado).
     */
    public EspelhoMesResponse espelhoDoMes(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = marcacoesPorDiaNoMesCorrente(usuario, hoje);
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        List<EspelhoDiaResponse> dias = marcacoesPorDia.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entrada -> {
                    LocalDate data = entrada.getKey();
                    List<Marcacao> marcacoesDoDia = entrada.getValue();
                    Instant fimDoDia = data.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
                    EstadoDia estado = EstadoDia.calcular(marcacoesDoDia, fimDoDia, agora);
                    long minutosTrabalhados = JornadaDiaria.minutosTrabalhados(marcacoesDoDia);
                    long saldoDia = JornadaDiaria.saldo(marcacoesDoDia, cargaDiariaMinutos);
                    return new EspelhoDiaResponse(data, estado, minutosTrabalhados, saldoDia);
                })
                .toList();

        long saldoAcumuladoNoPeriodo = SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos);

        return new EspelhoMesResponse(dias, saldoAcumuladoNoPeriodo);
    }

    private Map<LocalDate, List<Marcacao>> marcacoesPorDiaNoMesCorrente(Usuario usuario, LocalDate hoje) {
        Instant inicioDoPeriodo = hoje.withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<RegistroPonto> registrosDoPeriodo = registroPontoRepository
                .findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(usuario, inicioDoPeriodo);

        return registrosDoPeriodo.stream()
                .collect(Collectors.groupingBy(
                        registro -> registro.getMomento().atZone(ZoneOffset.UTC).toLocalDate(),
                        LinkedHashMap::new,
                        Collectors.mapping(
                                registro -> new Marcacao(registro.getTipo(), registro.getMomento()),
                                Collectors.toList())));
    }
}
