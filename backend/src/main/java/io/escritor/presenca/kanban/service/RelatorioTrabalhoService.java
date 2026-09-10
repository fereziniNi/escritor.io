package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.FiltroRelatorioInvalidoException;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.kanban.web.TotalApontadoResponse;
import io.escritor.presenca.kanban.web.TotalPorCardResponse;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * "Onde o tempo foi" - continua nos mesmos dois endpoints de sempre (`GET
 * /apontamentos?agrupar=card`, usado pela "Jornada de hoje" do Ponto; `GET
 * /apontamentos/relatorio`, usado em Relatórios), só que somando {@link SessaoTrabalho} (o
 * cronômetro) em vez do antigo lançamento manual - substitui a parte de relatório de
 * {@code ApontamentoService} (removido).
 */
@Service
public class RelatorioTrabalhoService {

    private final SessaoTrabalhoRepository sessaoTrabalhoRepository;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;
    private final ProjetoRepository projetoRepository;

    public RelatorioTrabalhoService(
            SessaoTrabalhoRepository sessaoTrabalhoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService,
            ProjetoRepository projetoRepository) {
        this.sessaoTrabalhoRepository = sessaoTrabalhoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
        this.projetoRepository = projetoRepository;
    }

    /**
     * "Onde o tempo foi" por card, de um usuário - resolução/visibilidade delegadas a {@link
     * VisibilidadeUsuarioService#resolverAlvo} (colaborador só vê o próprio, gestor/admin podem
     * ver outros conforme a regra de sempre).
     */
    public List<TotalPorCardResponse> listarTotalPorCard(Long usuarioIdFiltro, Instant inicio, Instant fim, Usuario usuarioAutenticado) {
        Usuario usuarioAlvo = visibilidadeUsuarioService.resolverAlvo(
                usuarioIdFiltro, usuarioAutenticado, () -> new AcessoNegadoException("Sem acesso aos dados desse usuário"));

        List<SessaoTrabalho> sessoesDoPeriodo = sessaoTrabalhoRepository
                .findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuarioAlvo, inicio, fim);

        Map<Long, Long> totalPorCardId = sessoesDoPeriodo.stream()
                .collect(Collectors.groupingBy(s -> s.getCard().getId(), Collectors.summingLong(SessaoTrabalho::getMinutos)));
        // um card só pode ter um título por vez - qualquer sessão dele serve pra pegar o título
        // atual, não precisa reduzir/escolher entre várias.
        Map<Long, String> tituloPorCardId = sessoesDoPeriodo.stream()
                .collect(Collectors.toMap(s -> s.getCard().getId(), s -> s.getCard().getTitulo(), (primeiro, segundo) -> primeiro));

        return totalPorCardId.entrySet().stream()
                .map(entrada -> new TotalPorCardResponse(entrada.getKey(), tituloPorCardId.get(entrada.getKey()), entrada.getValue()))
                .sorted(Comparator.comparingLong(TotalPorCardResponse::totalMinutos).reversed())
                .toList();
    }

    /**
     * "Onde o esforço foi" por projeto - soma todas as sessões fechadas de todos os cards de
     * todas as colunas do projeto, de qualquer pessoa que trabalhou neles (não só um usuário) -
     * por isso restrito a gestor/admin no controller, não checado aqui.
     */
    public TotalApontadoResponse totalApontadoPorProjeto(Long projetoId, Instant inicio, Instant fim) {
        if (projetoId == null) {
            throw new FiltroRelatorioInvalidoException("Informe projetoId");
        }

        Projeto projeto =
                projetoRepository.findById(projetoId).orElseThrow(() -> new RecursoNaoEncontradoException("Projeto não encontrado: " + projetoId));
        List<SessaoTrabalho> sessoes = sessaoTrabalhoRepository
                .findByCard_Coluna_ProjetoAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(projeto, inicio, fim);

        long totalMinutos = sessoes.stream().mapToLong(SessaoTrabalho::getMinutos).sum();
        return new TotalApontadoResponse(totalMinutos);
    }
}
