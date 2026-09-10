package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import io.escritor.presenca.relatorio.domain.PreferenciasConteudoRelatorioDiario;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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
 *
 * <p>Pedido do usuário (V47): "adicionar mais informações... personalizado para o admin" -
 * {@link PreferenciasConteudoRelatorioDiario} decide quais dos seis blocos abaixo entram no texto;
 * cada consulta cara (eventos de card, reuniões) só roda se o bloco correspondente estiver ligado.
 */
@Service
public class RelatorioDiarioService {

    private static final DateTimeFormatter FORMATO_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final UsuarioRepository usuarioRepository;
    private final JornadaService jornadaService;
    private final CardEventoRepository cardEventoRepository;
    private final CardRepository cardRepository;
    private final ReuniaoRepository reuniaoRepository;
    private final RegistroPontoRepository registroPontoRepository;
    private final Clock clock;

    public RelatorioDiarioService(
            UsuarioRepository usuarioRepository,
            JornadaService jornadaService,
            CardEventoRepository cardEventoRepository,
            CardRepository cardRepository,
            ReuniaoRepository reuniaoRepository,
            RegistroPontoRepository registroPontoRepository,
            Clock clock) {
        this.usuarioRepository = usuarioRepository;
        this.jornadaService = jornadaService;
        this.cardEventoRepository = cardEventoRepository;
        this.cardRepository = cardRepository;
        this.reuniaoRepository = reuniaoRepository;
        this.registroPontoRepository = registroPontoRepository;
        this.clock = clock;
    }

    public String montarResumoDoDia(PreferenciasConteudoRelatorioDiario preferencias) {
        Instant agora = Instant.now(clock);
        LocalDate hoje = agora.atZone(ZoneOffset.UTC).toLocalDate();
        Instant inicioDoDia = hoje.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant fimDoDia = hoje.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Usuario> usuarios = usuarioRepository.findByAtivoTrueOrderByNomeAsc();
        StringBuilder texto = new StringBuilder("📋 Resumo do dia - ").append(FORMATO_DATA.format(hoje)).append('\n');

        if (usuarios.isEmpty()) {
            return texto.append("\nNenhum colaborador cadastrado.").toString();
        }

        // Cada consulta só roda se algum bloco ligado precisa dela - "personalizado" também
        // significa não pagar o custo de dado que ninguém pediu pra ver.
        Map<Long, List<CardEvento>> eventosPorAutor = preferencias.tarefasCriadasMovidas()
                ? cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(inicioDoDia, fimDoDia).stream()
                        .collect(Collectors.groupingBy(evento -> evento.getAutor().getId()))
                : Map.of();
        List<Reuniao> reunioesDeHoje = preferencias.reunioes() || preferencias.resumoEquipe()
                ? reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(usuarios, hoje, hoje)
                : List.of();

        List<String> ausentes = new ArrayList<>();
        long totalMinutosTrabalhados = 0;
        long totalTarefasConcluidas = 0;
        StringBuilder corpo = new StringBuilder();

        for (Usuario usuario : usuarios) {
            JornadaDoDiaResponse jornada = jornadaService.jornadaDoDia(usuario);
            List<Card> tarefasConcluidas = preferencias.tarefasConcluidas() || preferencias.resumoEquipe()
                    ? cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(
                            usuario, inicioDoDia, fimDoDia)
                    : List.of();
            long reunioesDaPessoa = contarReunioesDaPessoa(reunioesDeHoje, usuario);

            totalMinutosTrabalhados += jornada.minutosTrabalhados();
            totalTarefasConcluidas += tarefasConcluidas.size();

            // Ausência é sobre PONTO especificamente ("será que a pessoa apareceu hoje"), não
            // sobre atividade em geral - alguém sem marcação mas mexendo em tarefas ainda conta
            // como ausente aqui de propósito (é justamente o tipo de coisa que o chefe quer ver).
            // `&&` de propósito (não duas expressões separadas): com o bloco desligado, a
            // consulta ao ponto nem roda - "personalizado" também é não pagar o custo de dado que
            // ninguém pediu pra ver.
            boolean semPontoHoje = preferencias.ausencias()
                    && !registroPontoRepository.existsByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThan(usuario, inicioDoDia, fimDoDia);
            if (semPontoHoje) {
                ausentes.add(usuario.getNome());
                continue;
            }

            corpo.append('\n')
                    .append(linhaDoUsuario(
                            usuario, preferencias, jornada, eventosPorAutor.getOrDefault(usuario.getId(), List.of()), tarefasConcluidas,
                            reunioesDaPessoa));
        }

        if (preferencias.resumoEquipe()) {
            texto.append('\n').append(resumoDaEquipe(totalMinutosTrabalhados, totalTarefasConcluidas, reunioesDeHoje.size()));
        }
        texto.append(corpo);

        if (preferencias.ausencias() && !ausentes.isEmpty()) {
            texto.append('\n').append("🚫 Sem ponto batido hoje: ").append(String.join(", ", ausentes));
        }

        return texto.toString().stripTrailing();
    }

    private String linhaDoUsuario(
            Usuario usuario,
            PreferenciasConteudoRelatorioDiario preferencias,
            JornadaDoDiaResponse jornada,
            List<CardEvento> eventos,
            List<Card> tarefasConcluidas,
            long reunioesDaPessoa) {
        long criadas = eventos.stream().filter(evento -> evento.getTipo() == TipoEventoCard.CRIACAO).count();
        long movidas = eventos.stream().filter(evento -> evento.getTipo() == TipoEventoCard.MUDANCA_COLUNA).count();

        StringBuilder linha = new StringBuilder("👤 ").append(usuario.getNome()).append('\n');
        boolean teveConteudo = false;

        if (preferencias.ponto() && jornada.minutosTrabalhados() > 0) {
            linha.append("   ⏱️ ").append(formatarMinutos(jornada.minutosTrabalhados())).append(" trabalhados\n");
            teveConteudo = true;
        }
        if (preferencias.ponto() && jornada.totalApontadoMinutos() > 0) {
            linha.append("   🧾 ").append(jornada.totalApontadoMinutos()).append(" min apontados em tarefas\n");
            teveConteudo = true;
        }
        if (preferencias.tarefasCriadasMovidas() && (criadas > 0 || movidas > 0)) {
            linha.append("   📌 ").append(criadas).append(" tarefa(s) criada(s), ").append(movidas).append(" movida(s)\n");
            teveConteudo = true;
        }
        if (preferencias.tarefasConcluidas() && !tarefasConcluidas.isEmpty()) {
            linha.append("   ✅ ").append(tarefasConcluidas.size()).append(" tarefa(s) concluída(s)\n");
            teveConteudo = true;
        }
        if (preferencias.reunioes() && reunioesDaPessoa > 0) {
            linha.append("   📅 ").append(reunioesDaPessoa).append(" reunião(ões) hoje\n");
            teveConteudo = true;
        }

        if (!teveConteudo) {
            linha.append("   sem atividade hoje\n");
        }
        return linha.toString();
    }

    private static long contarReunioesDaPessoa(List<Reuniao> reunioes, Usuario usuario) {
        return reunioes.stream()
                .filter(reuniao -> reuniao.getParticipantes().stream()
                        .anyMatch(participante -> participante.getUsuario().getId().equals(usuario.getId())))
                .count();
    }

    private static String resumoDaEquipe(long totalMinutosTrabalhados, long totalTarefasConcluidas, int totalReunioes) {
        return "📊 Equipe hoje: " + formatarMinutos(totalMinutosTrabalhados) + " trabalhadas, " + totalTarefasConcluidas
                + " tarefa(s) concluída(s), " + totalReunioes + " reunião(ões)\n";
    }

    /** Pedido do usuário: "Mostre sempre as horas menor que 1 hora em minutos... formatado de
     * forma clara e objetiva" - mesma regra do frontend (`formatarMinutos.ts`): abaixo de 1h, só
     * minutos ("45 min"); a partir de 1h, hora exata sem "00min" à toa ("2h") e com sobra por
     * extenso ("2h30min", nunca "2h30" sem unidade). */
    private static String formatarMinutos(long minutos) {
        long horas = minutos / 60;
        long resto = minutos % 60;
        if (horas == 0) {
            return resto + " min";
        }
        return resto == 0 ? horas + "h" : horas + "h" + String.format("%02d", resto) + "min";
    }
}
