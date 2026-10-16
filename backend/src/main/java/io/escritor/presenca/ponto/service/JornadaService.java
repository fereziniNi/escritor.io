package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.domain.JornadaDiaria;
import io.escritor.presenca.ponto.domain.Marcacao;
import io.escritor.presenca.ponto.domain.MesInvalidoException;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SaldoAcumulado;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.EspelhoDiaResponse;
import io.escritor.presenca.ponto.web.EspelhoMesResponse;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import io.escritor.presenca.ponto.web.RegistroPontoResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Período (tanto de "saldo acumulado" quanto do espelho do mês, S2.14) é sempre mês corrente até
 * hoje (dia 1 à meia-noite até agora). "Dia" é o dia civil no fuso do `Clock` - o da empresa,
 * America/Sao_Paulo (`ClockConfig`); antes era UTC e uma jornada que passava das 21h ficava partida
 * em dois dias (ver ADR 0010).
 */
@Service
public class JornadaService {

    private final RegistroPontoRepository registroPontoRepository;
    private final SessaoTrabalhoRepository sessaoTrabalhoRepository;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;
    private final Clock clock;

    public JornadaService(
            RegistroPontoRepository registroPontoRepository,
            SessaoTrabalhoRepository sessaoTrabalhoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService,
            Clock clock) {
        this.registroPontoRepository = registroPontoRepository;
        this.sessaoTrabalhoRepository = sessaoTrabalhoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
        this.clock = clock;
    }

    /**
     * PRD §2: gestor vê jornada e relatórios de quem está atribuído aos mesmos projetos que ele
     * (sem Equipe/Quadro, ver {@link VisibilidadeUsuarioService}). Entrada pública usada pelo
     * controller (S5.2) - resolve/autoriza `usuarioId` via {@link VisibilidadeUsuarioService}
     * (S5.1) e delega pro cálculo de sempre ({@link #jornadaDoDia(Usuario)}), que continua sem
     * checar nada, só calculando pra quem for passado.
     */
    public JornadaDoDiaResponse jornadaDoDia(Long usuarioIdFiltro, Usuario usuarioAutenticado) {
        return jornadaDoDia(visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new));
    }

    /** Mesma ideia de {@link #jornadaDoDia(Long, Usuario)}, pro espelho do mês corrente. */
    public EspelhoMesResponse espelhoDoMes(Long usuarioIdFiltro, Usuario usuarioAutenticado) {
        return espelhoDoMes(usuarioIdFiltro, null, usuarioAutenticado);
    }

    /** Espelho de qualquer mês até o corrente (`mes` nulo = corrente) - auditoria do histórico. */
    public EspelhoMesResponse espelhoDoMes(Long usuarioIdFiltro, YearMonth mes, Usuario usuarioAutenticado) {
        return espelhoDoMes(
                visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new),
                mes);
    }

    /**
     * Cada marcação do mês com a origem (WEB ou ADMIN) - o espelho só mostra o total por dia, isso
     * deixa conferir de onde vieram as horas (ajustes de administrador aparecem como tal).
     */
    public List<RegistroPontoResponse> marcacoesDoMes(Long usuarioIdFiltro, YearMonth mes, Usuario usuarioAutenticado) {
        Usuario alvo =
                visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new);
        YearMonth mesConsultado = validarMes(mes);
        return registroPontoRepository
                .findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        alvo, inicioDoMes(mesConsultado), inicioDoMes(mesConsultado.plusMonths(1)))
                .stream()
                .map(RegistroPontoResponse::de)
                .toList();
    }

    /** Meses com marcação, do mais recente ao mais antigo; o mês corrente sempre aparece. */
    public List<YearMonth> mesesDisponiveis(Long usuarioIdFiltro, Usuario usuarioAutenticado) {
        Usuario alvo =
                visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new);
        Set<YearMonth> meses = new TreeSet<>(Comparator.reverseOrder());
        meses.add(mesCorrente());
        registroPontoRepository.findByUsuarioOrderByMomentoAsc(alvo)
                .forEach(registro -> meses.add(YearMonth.from(registro.getMomento().atZone(clock.getZone()))));
        return List.copyOf(meses);
    }

    /**
     * `totalApontadoMinutos` é um cálculo paralelo ao saldo de ponto (E1), nunca o altera - PRD
     * §3.4: tempo de card é dado de gestão, não de jornada. Só soma sessões do cronômetro já
     * fechadas do dia; uma sessão ainda aberta não entra na soma.
     */
    public JornadaDoDiaResponse jornadaDoDia(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(clock.getZone()).toLocalDate();
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = marcacoesPorDiaNoMesCorrente(usuario, hoje);

        List<Marcacao> marcacoesDeHoje = marcacoesPorDia.getOrDefault(hoje, List.of());
        Instant inicioDoDia = hoje.atStartOfDay(clock.getZone()).toInstant();
        Instant fimDoDia = hoje.plusDays(1).atStartOfDay(clock.getZone()).toInstant();
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        EstadoDia estado = EstadoDia.calcular(marcacoesDeHoje, fimDoDia, agora);
        long minutosTrabalhados = JornadaDiaria.minutosTrabalhados(marcacoesDeHoje);
        long saldoDia = JornadaDiaria.saldo(marcacoesDeHoje, cargaDiariaMinutos);
        long saldoAcumuladoNoPeriodo = SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos);
        long totalApontadoMinutos = sessaoTrabalhoRepository
                .findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, inicioDoDia, fimDoDia)
                .stream()
                .mapToLong(SessaoTrabalho::getMinutos)
                .sum();

        return new JornadaDoDiaResponse(hoje, estado, minutosTrabalhados, saldoDia, saldoAcumuladoNoPeriodo, totalApontadoMinutos);
    }

    /**
     * Pro cronômetro ao vivo do frontend (`CronometroTrabalho`, canto superior direito) - só o
     * segmento de hoje, diferente de {@link #jornadaDoDia(Usuario)}, que também calcula estado/
     * saldo/apontamento. Sem checagem de visibilidade porque só é chamado pelo próprio usuário
     * autenticado sobre si mesmo (via `PontoService.estadoAtual`), nunca com um `usuarioId` de
     * outra pessoa.
     */
    public long segundosTrabalhadosAteAgora(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(clock.getZone()).toLocalDate();
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = marcacoesPorDiaNoMesCorrente(usuario, hoje);
        List<Marcacao> marcacoesDeHoje = marcacoesPorDia.getOrDefault(hoje, List.of());
        return JornadaDiaria.segundosTrabalhadosAteAgora(marcacoesDeHoje, agora);
    }

    /**
     * Só lista dias com pelo menos uma marcação - um dia sem nenhum registro não aparece (mesma
     * regra que {@link io.escritor.presenca.ponto.domain.SaldoAcumulado} já segue pro acumulado).
     */
    public EspelhoMesResponse espelhoDoMes(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(clock.getZone()).toLocalDate();
        return montarEspelho(usuario, marcacoesPorDiaNoMesCorrente(usuario, hoje), agora);
    }

    /** `mes` nulo ou igual ao corrente cai no caminho de sempre; mês passado busca o mês inteiro. */
    public EspelhoMesResponse espelhoDoMes(Usuario usuario, YearMonth mes) {
        YearMonth mesConsultado = validarMes(mes);
        if (mesConsultado.equals(mesCorrente())) {
            return espelhoDoMes(usuario);
        }
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = agruparPorDia(
                registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        usuario, inicioDoMes(mesConsultado), inicioDoMes(mesConsultado.plusMonths(1))),
                clock.getZone());
        return montarEspelho(usuario, marcacoesPorDia, Instant.now(clock));
    }

    private EspelhoMesResponse montarEspelho(Usuario usuario, Map<LocalDate, List<Marcacao>> marcacoesPorDia, Instant agora) {
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        List<EspelhoDiaResponse> dias = marcacoesPorDia.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entrada -> {
                    LocalDate data = entrada.getKey();
                    List<Marcacao> marcacoesDoDia = entrada.getValue();
                    Instant fimDoDia = data.plusDays(1).atStartOfDay(clock.getZone()).toInstant();
                    EstadoDia estado = EstadoDia.calcular(marcacoesDoDia, fimDoDia, agora);
                    long minutosTrabalhados = JornadaDiaria.minutosTrabalhados(marcacoesDoDia);
                    long saldoDia = JornadaDiaria.saldo(marcacoesDoDia, cargaDiariaMinutos);
                    return new EspelhoDiaResponse(data, estado, minutosTrabalhados, saldoDia);
                })
                .toList();

        long saldoAcumuladoNoPeriodo = SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos);

        return new EspelhoMesResponse(dias, saldoAcumuladoNoPeriodo);
    }

    /**
     * Dias inconsistentes (S5.7) num período arbitrário - diferente de {@link #jornadaDoDia}, que
     * só olha "hoje", isso vale pra qualquer intervalo passado. Reusa {@link EstadoDia#calcular}
     * (S2.8) por dia; um dia sem nenhuma marcação nunca é "inconsistente" (nem aparece no mapa
     * agrupado), mesma convenção de {@link #espelhoDoMes(Usuario)} ("só lista dias com pelo menos
     * uma marcação").
     */
    public List<LocalDate> diasInconsistentes(Long usuarioIdFiltro, Instant inicio, Instant fim, Usuario usuarioAutenticado) {
        Usuario usuarioAlvo =
                visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, JornadaDeOutroUsuarioException::new);
        Instant agora = Instant.now(clock);

        Map<LocalDate, List<Marcacao>> marcacoesPorDia = agruparPorDia(
                registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
                        usuarioAlvo, inicio, fim),
                clock.getZone());

        return marcacoesPorDia.entrySet().stream()
                .filter(entrada -> {
                    Instant fimDoDia = entrada.getKey().plusDays(1).atStartOfDay(clock.getZone()).toInstant();
                    return EstadoDia.calcular(entrada.getValue(), fimDoDia, agora) == EstadoDia.INCONSISTENTE;
                })
                .map(Map.Entry::getKey)
                .sorted()
                .toList();
    }

    private YearMonth mesCorrente() {
        return YearMonth.from(Instant.now(clock).atZone(clock.getZone()));
    }

    /** Mês nulo vira o corrente; mês depois do corrente não tem o que mostrar. */
    private YearMonth validarMes(YearMonth mes) {
        YearMonth corrente = mesCorrente();
        if (mes == null) {
            return corrente;
        }
        if (mes.isAfter(corrente)) {
            throw new MesInvalidoException();
        }
        return mes;
    }

    private Instant inicioDoMes(YearMonth mes) {
        return mes.atDay(1).atStartOfDay(clock.getZone()).toInstant();
    }

    private Map<LocalDate, List<Marcacao>> marcacoesPorDiaNoMesCorrente(Usuario usuario, LocalDate hoje) {
        Instant inicioDoPeriodo = hoje.withDayOfMonth(1).atStartOfDay(clock.getZone()).toInstant();

        List<RegistroPonto> registrosDoPeriodo = registroPontoRepository
                .findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(usuario, inicioDoPeriodo);

        return agruparPorDia(registrosDoPeriodo, clock.getZone());
    }

    /** Package-private: o fechamento mensal (`FechamentoMesService`) agrupa do mesmo jeito. */
    static Map<LocalDate, List<Marcacao>> agruparPorDia(List<RegistroPonto> registros, ZoneId fuso) {
        return registros.stream()
                .collect(Collectors.groupingBy(
                        registro -> registro.getMomento().atZone(fuso).toLocalDate(),
                        LinkedHashMap::new,
                        Collectors.mapping(
                                registro -> new Marcacao(registro.getTipo(), registro.getMomento()),
                                Collectors.toList())));
    }
}
