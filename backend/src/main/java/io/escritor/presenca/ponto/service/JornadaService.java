package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDiaria;
import io.escritor.presenca.ponto.domain.Marcacao;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SaldoAcumulado;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
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
 * Período de "saldo acumulado" é sempre mês corrente até hoje (dia 1 às 00:00 UTC até agora) - o
 * espelho de período arbitrário fica pra S2.14. "Dia" é sempre o dia civil em UTC: o sistema
 * ainda não tem noção de fuso horário da empresa (ver ADR 0010).
 */
@Service
public class JornadaService {

    private final RegistroPontoRepository registroPontoRepository;
    private final Clock clock;

    public JornadaService(RegistroPontoRepository registroPontoRepository, Clock clock) {
        this.registroPontoRepository = registroPontoRepository;
        this.clock = clock;
    }

    public JornadaDoDiaResponse jornadaDoDia(Usuario usuario) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();
        Instant inicioDoPeriodo = hoje.withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<RegistroPonto> registrosDoPeriodo = registroPontoRepository
                .findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(usuario, inicioDoPeriodo);

        Map<LocalDate, List<Marcacao>> marcacoesPorDia = registrosDoPeriodo.stream()
                .collect(Collectors.groupingBy(
                        registro -> registro.getMomento().atZone(ZoneOffset.UTC).toLocalDate(),
                        LinkedHashMap::new,
                        Collectors.mapping(
                                registro -> new Marcacao(registro.getTipo(), registro.getMomento()),
                                Collectors.toList())));

        List<Marcacao> marcacoesDeHoje = marcacoesPorDia.getOrDefault(hoje, List.of());
        Instant fimDoDia = hoje.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        EstadoDia estado = EstadoDia.calcular(marcacoesDeHoje, fimDoDia, agora);
        long minutosTrabalhados = JornadaDiaria.minutosTrabalhados(marcacoesDeHoje);
        long saldoDia = JornadaDiaria.saldo(marcacoesDeHoje, cargaDiariaMinutos);
        long saldoAcumuladoNoPeriodo = SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos);

        return new JornadaDoDiaResponse(hoje, estado, minutosTrabalhados, saldoDia, saldoAcumuladoNoPeriodo);
    }
}
