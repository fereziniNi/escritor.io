package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento sobre o que
 * foi feito no dia pelos funcionarios" - resposta às duas perguntas de esclarecimento: enviado
 * como mensagem de WhatsApp (não arquivo) e cobre ponto (horas trabalhadas) + atividade em
 * projetos (tarefas/apontamentos), os dois juntos.
 *
 * <p>"Dia" aqui é o dia civil em UTC (00:00 até agora), mesma convenção do resto do módulo de
 * ponto (ver comentário em {@link JornadaService}, ADR 0010 - o sistema ainda não tem noção de
 * fuso horário da empresa pra fronteira do dia). O HORÁRIO de disparo do resumo é interpretado em
 * fuso de Brasil separadamente, em {@code EnvioRelatorioDiarioScheduler} - são duas decisões
 * independentes (quando o dia começa/termina vs. a que horas o chefe quer ler sobre ele).
 *
 * <p>Reaproveita {@link JornadaService#jornadaDoDia(Usuario)} (já calcula minutos trabalhados +
 * total apontado de hoje por usuário, sem checagem de visibilidade) em vez de duplicar a lógica -
 * o resumo diário é justamente o único caso de uso que precisa ver todo mundo de uma vez, sem
 * filtro de {@code VisibilidadeUsuarioService}.
 */
@Service
public class RelatorioDiarioService {

    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final UsuarioRepository usuarioRepository;
    private final JornadaService jornadaService;
    private final CardEventoRepository cardEventoRepository;
    private final Clock clock;

    public RelatorioDiarioService(
            UsuarioRepository usuarioRepository,
            JornadaService jornadaService,
            CardEventoRepository cardEventoRepository,
            Clock clock) {
        this.usuarioRepository = usuarioRepository;
        this.jornadaService = jornadaService;
        this.cardEventoRepository = cardEventoRepository;
        this.clock = clock;
    }

    public String montarResumoDoDia() {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();
        Instant inicioDoDia = hoje.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant fimDoDia = hoje.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Usuario> usuarios = usuarioRepository.findByAtivoTrueOrderByNomeAsc();
        Map<Long, List<CardEvento>> eventosPorAutor = cardEventoRepository
                .findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(inicioDoDia, fimDoDia)
                .stream()
                .collect(Collectors.groupingBy(evento -> evento.getAutor().getId()));

        StringBuilder texto = new StringBuilder("📋 Resumo do dia - ").append(FORMATO_DATA.format(hoje)).append('\n');

        if (usuarios.isEmpty()) {
            return texto.append("\nNenhum colaborador cadastrado.").toString();
        }

        for (Usuario usuario : usuarios) {
            texto.append('\n').append(linhaDoUsuario(usuario, eventosPorAutor.getOrDefault(usuario.getId(), List.of())));
        }

        return texto.toString().stripTrailing();
    }

    private String linhaDoUsuario(Usuario usuario, List<CardEvento> eventos) {
        JornadaDoDiaResponse jornada = jornadaService.jornadaDoDia(usuario);
        long criadas = eventos.stream().filter(evento -> evento.getTipo() == TipoEventoCard.CRIACAO).count();
        long movidas = eventos.stream().filter(evento -> evento.getTipo() == TipoEventoCard.MUDANCA_COLUNA).count();

        boolean semAtividade = jornada.minutosTrabalhados() == 0 && jornada.totalApontadoMinutos() == 0 && eventos.isEmpty();

        StringBuilder linha = new StringBuilder("👤 ").append(usuario.getNome()).append('\n');
        if (semAtividade) {
            return linha.append("   sem atividade hoje\n").toString();
        }
        if (jornada.minutosTrabalhados() > 0) {
            linha.append("   ⏱️ ").append(formatarMinutos(jornada.minutosTrabalhados())).append(" trabalhados\n");
        }
        if (jornada.totalApontadoMinutos() > 0) {
            linha.append("   🧾 ").append(jornada.totalApontadoMinutos()).append(" min apontados em tarefas\n");
        }
        if (criadas > 0 || movidas > 0) {
            linha.append("   📌 ").append(criadas).append(" tarefa(s) criada(s), ").append(movidas).append(" movida(s)\n");
        }
        return linha.toString();
    }

    private static String formatarMinutos(long minutos) {
        long horas = minutos / 60;
        long resto = minutos % 60;
        return horas > 0 ? horas + "h" + String.format("%02d", resto) : resto + " min";
    }
}
