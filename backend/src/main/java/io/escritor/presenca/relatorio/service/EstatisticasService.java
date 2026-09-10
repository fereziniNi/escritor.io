package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.ponto.domain.JornadaDiaria;
import io.escritor.presenca.ponto.domain.Marcacao;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.relatorio.domain.EstatisticasDeOutroUsuarioException;
import io.escritor.presenca.relatorio.web.EstatisticasEquipeResponse;
import io.escritor.presenca.relatorio.web.EstatisticasPessoaisResponse;
import io.escritor.presenca.relatorio.web.EstatisticasResponse;
import io.escritor.presenca.relatorio.web.RankingPessoaResponse;
import io.escritor.presenca.relatorio.web.TarefaConcluidaResponse;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.domain.ReuniaoParticipante;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Pedido do usuário: "total de horas trabalhadas, quantidade de atividades feitas, o que fez,
 * quantos projetos concluiu... horário que mais trabalhou, pessoa que fez mais reuniões, horário
 * preferido de reuniões, um monte de estatística legal" - um endpoint agregador só, em vez do
 * frontend juntar várias chamadas na mão (`RelatoriosPage`). Reaproveita dado que já existe em
 * três domínios (ponto, kanban, reunião), sem armazenamento novo nenhum.
 */
@Service
public class EstatisticasService {

    private final RegistroPontoRepository registroPontoRepository;
    private final SessaoTrabalhoRepository sessaoTrabalhoRepository;
    private final CardRepository cardRepository;
    private final ReuniaoRepository reuniaoRepository;
    private final MembroProjetoRepository membroProjetoRepository;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;

    public EstatisticasService(
            RegistroPontoRepository registroPontoRepository,
            SessaoTrabalhoRepository sessaoTrabalhoRepository,
            CardRepository cardRepository,
            ReuniaoRepository reuniaoRepository,
            MembroProjetoRepository membroProjetoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService) {
        this.registroPontoRepository = registroPontoRepository;
        this.sessaoTrabalhoRepository = sessaoTrabalhoRepository;
        this.cardRepository = cardRepository;
        this.reuniaoRepository = reuniaoRepository;
        this.membroProjetoRepository = membroProjetoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
    }

    /**
     * Mesma regra de visibilidade de sempre pro `usuarioIdFiltro` ({@link
     * VisibilidadeUsuarioService#resolverAlvo}); os rankings de equipe usam {@link
     * VisibilidadeUsuarioService#listarUsuariosVisiveis} sobre quem está autenticado, não sobre o
     * alvo - pra colaborador, sempre colapsa numa lista de 1 pessoa (ele mesmo).
     */
    public EstatisticasResponse calcular(Long usuarioIdFiltro, Instant inicio, Instant fim, Usuario usuarioAutenticado) {
        Usuario usuarioAlvo =
                visibilidadeUsuarioService.resolverAlvo(usuarioIdFiltro, usuarioAutenticado, EstatisticasDeOutroUsuarioException::new);
        List<Usuario> usuariosVisiveis = visibilidadeUsuarioService.listarUsuariosVisiveis(usuarioAutenticado);

        LocalDate inicioData = inicio.atZone(ZoneOffset.UTC).toLocalDate();
        // `fim` é exclusivo, mesma convenção de sempre (frontend manda meia-noite do próprio dia
        // "fim" - ver `RelatoriosPage`) - mas `Reuniao.data` é `LocalDate` e a consulta é
        // inclusiva nos dois limites, então o último dia de fato incluído é um antes.
        LocalDate fimDataInclusive = fim.atZone(ZoneOffset.UTC).toLocalDate().minusDays(1);

        return new EstatisticasResponse(
                calcularPessoal(usuarioAlvo, inicio, fim, inicioData, fimDataInclusive),
                calcularEquipe(usuariosVisiveis, inicio, fim, inicioData, fimDataInclusive));
    }

    private EstatisticasPessoaisResponse calcularPessoal(
            Usuario usuario, Instant inicio, Instant fim, LocalDate inicioData, LocalDate fimData) {
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = agruparPorDia(
                registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(usuario, inicio, fim));

        long totalMinutosTrabalhados = 0;
        int diasTrabalhados = 0;
        for (List<Marcacao> marcacoesDoDia : marcacoesPorDia.values()) {
            long minutos = JornadaDiaria.minutosTrabalhados(marcacoesDoDia);
            totalMinutosTrabalhados += minutos;
            if (minutos > 0) {
                diasTrabalhados++;
            }
        }
        long mediaMinutosPorDiaTrabalhado = diasTrabalhados == 0 ? 0 : totalMinutosTrabalhados / diasTrabalhados;

        int reunioesParticipadas = reuniaoRepository.findByParticipantes_UsuarioAndDataBetween(usuario, inicioData, fimData).size();

        List<Card> tarefasConcluidas = cardRepository
                .findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(usuario, inicio, fim);
        List<TarefaConcluidaResponse> tarefasConcluidasDetalhe = tarefasConcluidas.stream()
                .map(card -> new TarefaConcluidaResponse(
                        card.getId(), card.getTitulo(), card.getColuna().getProjeto().getNome(), card.getConcluidoEm(),
                        card.getDescricaoConclusao()))
                .toList();

        long projetosConcluidos = membroProjetoRepository.findByUsuario(usuario).stream()
                .map(MembroProjeto::getProjeto)
                .filter(projeto -> projeto.getStatus() == StatusProjeto.CONCLUIDO)
                .map(Projeto::getId)
                .distinct()
                .count();

        List<Integer> minutosPorHoraDoDia = histogramaDeMinutosPorHora(
                sessaoTrabalhoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, inicio, fim));

        return new EstatisticasPessoaisResponse(
                totalMinutosTrabalhados,
                diasTrabalhados,
                mediaMinutosPorDiaTrabalhado,
                reunioesParticipadas,
                tarefasConcluidas.size(),
                tarefasConcluidasDetalhe,
                (int) projetosConcluidos,
                minutosPorHoraDoDia);
    }

    private EstatisticasEquipeResponse calcularEquipe(
            List<Usuario> usuariosVisiveis, Instant inicio, Instant fim, LocalDate inicioData, LocalDate fimData) {
        List<RankingPessoaResponse> rankingHorasTrabalhadas = usuariosVisiveis.stream()
                .map(usuario -> new RankingPessoaResponse(usuario.getId(), usuario.getNome(), totalMinutosTrabalhados(usuario, inicio, fim)))
                .sorted(Comparator.comparingLong(RankingPessoaResponse::valor).reversed())
                .toList();

        List<RankingPessoaResponse> rankingTarefasConcluidas = usuariosVisiveis.stream()
                .map(usuario -> new RankingPessoaResponse(
                        usuario.getId(), usuario.getNome(),
                        cardRepository.countByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThan(usuario, inicio, fim)))
                .sorted(Comparator.comparingLong(RankingPessoaResponse::valor).reversed())
                .toList();

        List<Reuniao> reunioesDaEquipe =
                reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(usuariosVisiveis, inicioData, fimData);
        Set<Long> idsVisiveis = usuariosVisiveis.stream().map(Usuario::getId).collect(Collectors.toSet());
        Map<Long, String> nomePorId = usuariosVisiveis.stream().collect(Collectors.toMap(Usuario::getId, Usuario::getNome));
        Map<Long, Long> reunioesPorPessoa = new LinkedHashMap<>();
        usuariosVisiveis.forEach(usuario -> reunioesPorPessoa.put(usuario.getId(), 0L));
        List<Integer> reunioesPorHoraDoDia = new ArrayList<>(Collections.nCopies(24, 0));

        for (Reuniao reuniao : reunioesDaEquipe) {
            int hora = reuniao.getHoraInicio().getHour();
            reunioesPorHoraDoDia.set(hora, reunioesPorHoraDoDia.get(hora) + 1);
            for (ReuniaoParticipante participante : reuniao.getParticipantes()) {
                Long idParticipante = participante.getUsuario().getId();
                // só conta pra quem o requisitante enxerga - uma reunião entre alguém visível e
                // alguém de fora não vaza a contagem de quem está de fora.
                if (idsVisiveis.contains(idParticipante)) {
                    reunioesPorPessoa.merge(idParticipante, 1L, Long::sum);
                }
            }
        }

        List<RankingPessoaResponse> rankingReunioes = reunioesPorPessoa.entrySet().stream()
                .map(entrada -> new RankingPessoaResponse(entrada.getKey(), nomePorId.get(entrada.getKey()), entrada.getValue()))
                .sorted(Comparator.comparingLong(RankingPessoaResponse::valor).reversed())
                .toList();

        return new EstatisticasEquipeResponse(rankingHorasTrabalhadas, rankingTarefasConcluidas, rankingReunioes, reunioesPorHoraDoDia);
    }

    private long totalMinutosTrabalhados(Usuario usuario, Instant inicio, Instant fim) {
        Map<LocalDate, List<Marcacao>> marcacoesPorDia = agruparPorDia(
                registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(usuario, inicio, fim));
        return marcacoesPorDia.values().stream().mapToLong(JornadaDiaria::minutosTrabalhados).sum();
    }

    /** Simplificação aceita: uma sessão inteira conta na hora em que COMEÇOU, mesmo que atravesse
     * pra hora seguinte (ex. sessão de 13:50 às 14:20 conta inteira às 13h) - dividir a duração
     * entre horas é complexidade desproporcional pro que é, no fim, um gráfico ilustrativo de "que
     * horas costuma trabalhar". */
    private static List<Integer> histogramaDeMinutosPorHora(List<SessaoTrabalho> sessoes) {
        List<Integer> minutosPorHora = new ArrayList<>(Collections.nCopies(24, 0));
        for (SessaoTrabalho sessao : sessoes) {
            int hora = sessao.getInicio().atZone(ZoneOffset.UTC).getHour();
            minutosPorHora.set(hora, minutosPorHora.get(hora) + sessao.getMinutos().intValue());
        }
        return minutosPorHora;
    }

    /** Mesma técnica de {@code JornadaService#agruparPorDia} - não dá pra reusar de lá porque é
     * `private static` naquela classe. */
    private static Map<LocalDate, List<Marcacao>> agruparPorDia(List<RegistroPonto> registros) {
        return registros.stream()
                .collect(Collectors.groupingBy(
                        registro -> registro.getMomento().atZone(ZoneOffset.UTC).toLocalDate(),
                        LinkedHashMap::new,
                        Collectors.mapping(
                                registro -> new Marcacao(registro.getTipo(), registro.getMomento()),
                                Collectors.toList())));
    }
}
