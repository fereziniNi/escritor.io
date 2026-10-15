package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.domain.JornadaDiaria;
import io.escritor.presenca.ponto.domain.Marcacao;
import io.escritor.presenca.ponto.domain.MesInvalidoException;
import io.escritor.presenca.ponto.domain.SaldoAcumulado;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.FechamentoMesPessoaResponse;
import io.escritor.presenca.ponto.web.FechamentoMesResponse;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Pedido do usuário: "o admin conseguisse exportar um relatório do mês que ele quiser e ver as
 * horas de cada pessoa naquele mês, com um saldo total de horas sobrando ou faltando de cada
 * pessoa". Mesmo cálculo do espelho individual ({@link JornadaService}) - minutos por dia via
 * {@link JornadaDiaria}, saldo via {@link SaldoAcumulado} (só dias úteis com marcação) - só que
 * pra todo mundo de uma vez. Dia útil sem marcação nenhuma não entra no saldo (mesma regra do
 * espelho), por isso vem separado em `diasUteisSemMarcacao`: o admin vê a falta sem o saldo
 * divergir do que a própria pessoa vê no espelho dela.
 */
@Service
public class FechamentoMesService {

    private final RegistroPontoRepository registroPontoRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public FechamentoMesService(RegistroPontoRepository registroPontoRepository, UsuarioRepository usuarioRepository, Clock clock) {
        this.registroPontoRepository = registroPontoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    /** `mes` nulo = mês corrente (UTC, como o resto do ponto); mês futuro é rejeitado. */
    public FechamentoMesResponse fechamento(YearMonth mes) {
        Instant agora = Instant.now(clock);
        YearMonth mesCorrente = YearMonth.from(agora.atZone(ZoneOffset.UTC));
        YearMonth mesConsultado = mes == null ? mesCorrente : mes;
        if (mesConsultado.isAfter(mesCorrente)) {
            throw new MesInvalidoException();
        }

        Instant inicio = mesConsultado.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant fim = mesConsultado.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();

        List<FechamentoMesPessoaResponse> pessoas = usuarioRepository.findByAtivoTrueOrderByNomeAsc().stream()
                .map(usuario -> fechamentoDaPessoa(usuario, mesConsultado, inicio, fim, hoje, agora))
                .toList();

        return new FechamentoMesResponse(mesConsultado.toString(), pessoas);
    }

    private FechamentoMesPessoaResponse fechamentoDaPessoa(
            Usuario usuario, YearMonth mes, Instant inicio, Instant fim, LocalDate hoje, Instant agora) {
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = JornadaService.agruparPorDia(
                registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(usuario, inicio, fim));
        int cargaDiariaMinutos = usuario.getCargaDiariaMinutos();

        long minutosTrabalhados = 0;
        int diasTrabalhados = 0;
        int diasInconsistentes = 0;
        for (Map.Entry<LocalDate, List<Marcacao>> dia : marcacoesPorDia.entrySet()) {
            long minutosDoDia = JornadaDiaria.minutosTrabalhados(dia.getValue());
            minutosTrabalhados += minutosDoDia;
            if (minutosDoDia > 0) {
                diasTrabalhados++;
            }
            Instant fimDoDia = dia.getKey().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            if (EstadoDia.calcular(dia.getValue(), fimDoDia, agora) == EstadoDia.INCONSISTENTE) {
                diasInconsistentes++;
            }
        }

        return new FechamentoMesPessoaResponse(
                usuario.getId(),
                usuario.getNome(),
                cargaDiariaMinutos,
                diasTrabalhados,
                minutosTrabalhados,
                SaldoAcumulado.calcular(marcacoesPorDia, cargaDiariaMinutos),
                diasUteisSemMarcacao(usuario, mes, hoje, marcacoesPorDia),
                diasInconsistentes);
    }

    /**
     * Dias úteis já encerrados (antes de hoje) sem nenhuma marcação - hoje ainda pode ser marcado,
     * e dia anterior ao cadastro da pessoa não é falta dela.
     */
    private static int diasUteisSemMarcacao(
            Usuario usuario, YearMonth mes, LocalDate hoje, Map<LocalDate, List<Marcacao>> marcacoesPorDia) {
        LocalDate cadastro = usuario.getCriadoEm() == null ? null : usuario.getCriadoEm().atZone(ZoneOffset.UTC).toLocalDate();
        int dias = 0;
        for (LocalDate data = mes.atDay(1); !data.isAfter(mes.atEndOfMonth()) && data.isBefore(hoje); data = data.plusDays(1)) {
            boolean diaUtil = data.getDayOfWeek() != DayOfWeek.SATURDAY && data.getDayOfWeek() != DayOfWeek.SUNDAY;
            boolean antesDoCadastro = cadastro != null && data.isBefore(cadastro);
            if (diaUtil && !antesDoCadastro && !marcacoesPorDia.containsKey(data)) {
                dias++;
            }
        }
        return dias;
    }
}
