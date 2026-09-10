package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.relatorio.domain.EstatisticasDeOutroUsuarioException;
import io.escritor.presenca.relatorio.web.EstatisticasResponse;
import io.escritor.presenca.relatorio.web.RankingPessoaResponse;
import io.escritor.presenca.relatorio.web.TarefaConcluidaResponse;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EstatisticasServiceTest {

    private static final Instant INICIO = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant FIM = Instant.parse("2026-02-01T00:00:00Z");
    private static final LocalDate INICIO_DATA = LocalDate.of(2026, 1, 1);
    private static final LocalDate FIM_DATA_INCLUSIVE = LocalDate.of(2026, 1, 31);

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    @Mock
    private SessaoTrabalhoRepository sessaoTrabalhoRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private ReuniaoRepository reuniaoRepository;

    @Mock
    private MembroProjetoRepository membroProjetoRepository;

    @Mock
    private VisibilidadeUsuarioService visibilidadeUsuarioService;

    private EstatisticasService service;

    private Usuario usuario;
    private Projeto projeto;
    private Coluna coluna;

    private static Usuario usuarioComId(Long id, String nome) {
        Usuario u = new Usuario(nome, "u" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static Card cardComId(Coluna coluna, String titulo, Usuario responsavel, Usuario criadoPor, Long id) {
        Card card = new Card(coluna, titulo, null, 1024.0, responsavel, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    private static RegistroPonto registroComId(Usuario usuario, TipoRegistroPonto tipo, Instant momento, Long id) {
        RegistroPonto registro = new RegistroPonto(usuario, tipo, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "teste", null);
        ReflectionTestUtils.setField(registro, "id", id);
        return registro;
    }

    @BeforeEach
    void setUp() {
        service = new EstatisticasService(
                registroPontoRepository, sessaoTrabalhoRepository, cardRepository, reuniaoRepository, membroProjetoRepository,
                visibilidadeUsuarioService);
        usuario = usuarioComId(1L, "Ana Souza");
        projeto = new Projeto("Site novo", "Cliente Teste", StatusProjeto.CONCLUIDO, LocalDate.of(2025, 1, 1), null);
        ReflectionTestUtils.setField(projeto, "id", 5L);
        coluna = new Coluna(projeto, "Feito", 0, null);

        lenient().when(visibilidadeUsuarioService.resolverAlvo(isNull(), eq(usuario), any())).thenReturn(usuario);
        lenient().when(visibilidadeUsuarioService.listarUsuariosVisiveis(usuario)).thenReturn(List.of(usuario));
        lenient()
                .when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(usuario, INICIO, FIM))
                .thenReturn(List.of());
        lenient()
                .when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, INICIO, FIM))
                .thenReturn(List.of());
        lenient()
                .when(cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(
                        usuario, INICIO, FIM))
                .thenReturn(List.of());
        lenient().when(cardRepository.countByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThan(usuario, INICIO, FIM))
                .thenReturn(0L);
        lenient().when(membroProjetoRepository.findByUsuario(usuario)).thenReturn(List.of());
        lenient().when(reuniaoRepository.findByParticipantes_UsuarioAndDataBetween(usuario, INICIO_DATA, FIM_DATA_INCLUSIVE))
                .thenReturn(List.of());
        lenient().when(reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(anyList(), eq(INICIO_DATA), eq(FIM_DATA_INCLUSIVE)))
                .thenReturn(List.of());
    }

    @Test
    void somaMinutosTrabalhadosPorDiaIncluindoPausa() {
        when(registroPontoRepository.findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(usuario, INICIO, FIM))
                .thenReturn(List.of(
                        registroComId(usuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-10T09:00:00Z"), 1L),
                        registroComId(usuario, TipoRegistroPonto.PAUSA_INICIO, Instant.parse("2026-01-10T12:00:00Z"), 2L),
                        registroComId(usuario, TipoRegistroPonto.PAUSA_FIM, Instant.parse("2026-01-10T13:00:00Z"), 3L),
                        registroComId(usuario, TipoRegistroPonto.SAIDA, Instant.parse("2026-01-10T18:00:00Z"), 4L),
                        registroComId(usuario, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-11T09:00:00Z"), 5L),
                        registroComId(usuario, TipoRegistroPonto.SAIDA, Instant.parse("2026-01-11T17:00:00Z"), 6L)));

        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        // dia 10: 9h de expediente - 1h de pausa = 8h = 480min; dia 11: 8h = 480min.
        assertThat(resultado.pessoal().totalMinutosTrabalhados()).isEqualTo(960);
        assertThat(resultado.pessoal().diasTrabalhados()).isEqualTo(2);
        assertThat(resultado.pessoal().mediaMinutosPorDiaTrabalhado()).isEqualTo(480);
    }

    @Test
    void soContaTarefasConcluidasDoResponsavelCertoNoPeriodo() {
        Card tarefa = cardComId(coluna, "Publicar site", usuario, usuario, 10L);
        tarefa.finalizar("Site publicado em produção", Instant.parse("2026-01-15T10:00:00Z"));
        when(cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(
                        usuario, INICIO, FIM))
                .thenReturn(List.of(tarefa));

        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        assertThat(resultado.pessoal().tarefasConcluidas()).isEqualTo(1);
        TarefaConcluidaResponse detalhe = resultado.pessoal().tarefasConcluidasDetalhe().get(0);
        assertThat(detalhe.titulo()).isEqualTo("Publicar site");
        assertThat(detalhe.nomeProjeto()).isEqualTo("Site novo");
        assertThat(detalhe.descricaoConclusao()).isEqualTo("Site publicado em produção");
    }

    @Test
    void projetosConcluidosNaoEhFiltradoPeloPeriodoESoContaOndeEhMembro() {
        Projeto projetoAtivo = new Projeto("Em andamento", "Cliente B", StatusProjeto.ATIVO, LocalDate.of(2025, 1, 1), null);
        ReflectionTestUtils.setField(projetoAtivo, "id", 6L);
        when(membroProjetoRepository.findByUsuario(usuario))
                .thenReturn(List.of(new MembroProjeto(projeto, usuario), new MembroProjeto(projetoAtivo, usuario)));

        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        assertThat(resultado.pessoal().projetosConcluidos()).isEqualTo(1);
    }

    @Test
    void histogramaDeHoraContaSessaoInteiraNaHoraDeInicio() {
        SessaoTrabalho sessaoAs14h = new SessaoTrabalho(
                cardComId(coluna, "Corrigir bug", usuario, usuario, 20L), usuario, Instant.parse("2026-01-10T14:10:00Z"));
        sessaoAs14h.pausar(Instant.parse("2026-01-10T14:40:00Z"));
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, INICIO, FIM))
                .thenReturn(List.of(sessaoAs14h));

        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        List<Integer> minutosPorHora = resultado.pessoal().minutosPorHoraDoDia();
        assertThat(minutosPorHora).hasSize(24);
        assertThat(minutosPorHora.get(14)).isEqualTo(30);
        assertThat(minutosPorHora.stream().mapToInt(Integer::intValue).sum()).isEqualTo(30);
    }

    @Test
    void rankingDeEquipeRespeitaVisibilidadeEColapsaPraUmaPessoaQuandoSoOProprioUsuarioEhVisivel() {
        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        assertThat(resultado.equipe().rankingHorasTrabalhadas()).hasSize(1);
        assertThat(resultado.equipe().rankingHorasTrabalhadas().get(0).usuarioId()).isEqualTo(1L);
        assertThat(resultado.equipe().rankingTarefasConcluidas()).hasSize(1);
        assertThat(resultado.equipe().rankingReunioes()).hasSize(1);
    }

    @Test
    void reuniaoComDoisParticipantesVisiveisContaUmaVezPraCadaUm() {
        Usuario beto = usuarioComId(2L, "Beto Lima");
        when(visibilidadeUsuarioService.listarUsuariosVisiveis(usuario)).thenReturn(List.of(usuario, beto));
        Reuniao reuniao = new Reuniao(
                usuario, List.of(usuario, beto), LocalDate.of(2026, 1, 10), LocalTime.of(15, 0), LocalTime.of(15, 30), "Alinhamento",
                Instant.parse("2026-01-05T10:00:00Z"));
        when(reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(anyList(), eq(INICIO_DATA), eq(FIM_DATA_INCLUSIVE)))
                .thenReturn(List.of(reuniao));

        EstatisticasResponse resultado = service.calcular(null, INICIO, FIM, usuario);

        List<RankingPessoaResponse> ranking = resultado.equipe().rankingReunioes();
        assertThat(ranking).extracting(RankingPessoaResponse::usuarioId).containsExactlyInAnyOrder(1L, 2L);
        assertThat(ranking).allSatisfy(entrada -> assertThat(entrada.valor()).isEqualTo(1));
        assertThat(resultado.equipe().reunioesPorHoraDoDia().get(15)).isEqualTo(1);
    }

    @Test
    void semAcessoAoUsuarioFiltradoPropagaAExcecaoDeAcessoNegado() {
        Usuario colaborador = usuarioComId(1L, "Ana Souza");
        when(visibilidadeUsuarioService.resolverAlvo(eq(2L), eq(colaborador), any()))
                .thenThrow(new EstatisticasDeOutroUsuarioException());

        assertThatThrownBy(() -> service.calcular(2L, INICIO, FIM, colaborador)).isInstanceOf(EstatisticasDeOutroUsuarioException.class);
    }
}
