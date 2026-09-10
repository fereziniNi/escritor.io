package io.escritor.presenca.relatorio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import io.escritor.presenca.relatorio.domain.PreferenciasConteudoRelatorioDiario;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Pedido do cliente: "documento sobre o que foi feito no dia pelos funcionarios" - texto (não
 * arquivo, ver esclarecimento) cobrindo ponto + tarefas juntos. Pedido do usuário (V47):
 * "adicionar mais informações... personalizado para o admin" - {@link
 * PreferenciasConteudoRelatorioDiario} decide quais blocos entram.
 */
@ExtendWith(MockitoExtension.class)
class RelatorioDiarioServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T18:00:00Z");
    private static final LocalDate HOJE = LocalDate.of(2026, 1, 15);

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private JornadaService jornadaService;

    @Mock
    private CardEventoRepository cardEventoRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private ReuniaoRepository reuniaoRepository;

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    private RelatorioDiarioService servico;

    @BeforeEach
    void setUp() {
        servico = new RelatorioDiarioService(
                usuarioRepository, jornadaService, cardEventoRepository, cardRepository, reuniaoRepository, registroPontoRepository,
                Clock.fixed(AGORA, ZoneOffset.UTC));
        // Presente em quase todo teste (só não é chamado quando `usuarios` está vazio) - `lenient`
        // pra não forçar todo teste que não liga "ausências" a estubar isto também.
        lenient().when(registroPontoRepository.existsByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThan(any(), any(), any()))
                .thenReturn(true);
    }

    private static Usuario usuarioComId(String nome, Long id) {
        Usuario usuario = new Usuario(nome, nome.toLowerCase().replace(" ", ".") + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static JornadaDoDiaResponse jornada(long minutosTrabalhados, long totalApontadoMinutos) {
        return new JornadaDoDiaResponse(null, EstadoDia.ABERTA, minutosTrabalhados, 0, 0, totalApontadoMinutos);
    }

    private static CardEvento eventoDe(Usuario autor, TipoEventoCard tipo) {
        Card card = new Card(null, "Tarefa", null, 1024.0, null, null, null, autor);
        return new CardEvento(card, autor, tipo, null, "A fazer");
    }

    private static Card cardConcluidoPor(Usuario responsavel, String titulo, Long id) {
        Card card = new Card(null, titulo, null, 1024.0, responsavel, null, null, responsavel);
        ReflectionTestUtils.setField(card, "id", id);
        card.finalizar("feito", Instant.parse("2026-01-15T12:00:00Z"));
        return card;
    }

    @Test
    void tituloTrazADataDeHoje() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia(PreferenciasConteudoRelatorioDiario.padrao());

        assertThat(resumo).startsWith("📋 Resumo do dia - 15/01/2026");
    }

    @Test
    void listaCadaUsuarioComHorasTrabalhadasEApontamento() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana));
        when(jornadaService.jornadaDoDia(ana)).thenReturn(jornada(270, 90));
        when(cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(any(), any())).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia(PreferenciasConteudoRelatorioDiario.padrao());

        assertThat(resumo).contains("👤 Ana Souza").contains("4h30min trabalhados").contains("90 min apontados em tarefas");
    }

    @Test
    void contaTarefasCriadasEMovidasPorAutor() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        Usuario beto = usuarioComId("Beto Lima", 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));
        when(jornadaService.jornadaDoDia(any())).thenReturn(jornada(0, 0));
        when(cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(any(), any()))
                .thenReturn(List.of(
                        eventoDe(ana, TipoEventoCard.CRIACAO),
                        eventoDe(ana, TipoEventoCard.CRIACAO),
                        eventoDe(ana, TipoEventoCard.MUDANCA_COLUNA),
                        eventoDe(beto, TipoEventoCard.MUDANCA_COLUNA)));

        String resumo = servico.montarResumoDoDia(PreferenciasConteudoRelatorioDiario.padrao());

        assertThat(resumo).contains("👤 Ana Souza").contains("2 tarefa(s) criada(s), 1 movida(s)");
        assertThat(resumo).contains("👤 Beto Lima").contains("0 tarefa(s) criada(s), 1 movida(s)");
    }

    @Test
    void marcaSemAtividadeQuandoNaoTemNemPontoNemTarefa() {
        Usuario carlos = usuarioComId("Carlos Souza", 3L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(carlos));
        when(jornadaService.jornadaDoDia(carlos)).thenReturn(jornada(0, 0));
        when(cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(any(), any())).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia(PreferenciasConteudoRelatorioDiario.padrao());

        assertThat(resumo).contains("👤 Carlos Souza").contains("sem atividade hoje");
    }

    @Test
    void semColaboradorCadastradoAvisaExplicitamente() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia(PreferenciasConteudoRelatorioDiario.padrao());

        assertThat(resumo).contains("Nenhum colaborador cadastrado");
    }

    @Test
    void blocoDesligadoNaoAparecePraNinguemMesmoComDado() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana));
        when(jornadaService.jornadaDoDia(ana)).thenReturn(jornada(270, 90));

        String resumo = servico.montarResumoDoDia(new PreferenciasConteudoRelatorioDiario(false, false, false, false, false, false));

        assertThat(resumo).contains("👤 Ana Souza").contains("sem atividade hoje").doesNotContain("trabalhados").doesNotContain("apontados");
    }

    @Test
    void tarefasConcluidasSoApareceQuandoLigado() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana));
        when(jornadaService.jornadaDoDia(ana)).thenReturn(jornada(0, 0));
        when(cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(any(), any(), any()))
                .thenReturn(List.of(cardConcluidoPor(ana, "Publicar site", 10L)));

        String resumo = servico.montarResumoDoDia(new PreferenciasConteudoRelatorioDiario(false, false, true, false, false, false));

        assertThat(resumo).contains("👤 Ana Souza").contains("1 tarefa(s) concluída(s)");
    }

    @Test
    void reunioesDoDiaContaSoAsQueEnvolvemAPessoa() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        Usuario beto = usuarioComId("Beto Lima", 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));
        when(jornadaService.jornadaDoDia(any())).thenReturn(jornada(0, 0));
        Reuniao reuniaoDaAna =
                new Reuniao(ana, List.of(ana), HOJE, LocalTime.of(10, 0), LocalTime.of(10, 30), "1:1", Instant.parse("2026-01-14T10:00:00Z"));
        when(reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(any(), any(), any())).thenReturn(List.of(reuniaoDaAna));

        String resumo = servico.montarResumoDoDia(new PreferenciasConteudoRelatorioDiario(false, false, false, true, false, false));

        assertThat(resumo).contains("👤 Ana Souza").contains("1 reunião(ões) hoje");
        assertThat(resumo).contains("👤 Beto Lima").contains("sem atividade hoje");
    }

    @Test
    void ausenciaListaQuemNaoBateuPontoESaiDaListaPorPessoa() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        Usuario beto = usuarioComId("Beto Lima", 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));
        when(jornadaService.jornadaDoDia(any())).thenReturn(jornada(0, 0));
        when(registroPontoRepository.existsByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThan(eq(ana), any(), any())).thenReturn(true);
        when(registroPontoRepository.existsByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThan(eq(beto), any(), any())).thenReturn(false);

        String resumo = servico.montarResumoDoDia(new PreferenciasConteudoRelatorioDiario(true, false, false, false, true, false));

        assertThat(resumo).contains("👤 Ana Souza");
        assertThat(resumo).doesNotContain("👤 Beto Lima");
        assertThat(resumo).contains("🚫 Sem ponto batido hoje: Beto Lima");
    }

    @Test
    void resumoDaEquipeSomaOsNumerosDeTodoMundo() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        Usuario beto = usuarioComId("Beto Lima", 2L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana, beto));
        when(jornadaService.jornadaDoDia(ana)).thenReturn(jornada(120, 0));
        when(jornadaService.jornadaDoDia(beto)).thenReturn(jornada(60, 0));
        when(cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(eq(ana), any(), any()))
                .thenReturn(List.of(cardConcluidoPor(ana, "Tarefa 1", 10L)));
        when(cardRepository.findByResponsavelAndConcluidoEmGreaterThanEqualAndConcluidoEmLessThanOrderByConcluidoEmDesc(eq(beto), any(), any()))
                .thenReturn(List.of());
        when(reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(any(), any(), any())).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia(new PreferenciasConteudoRelatorioDiario(false, false, false, false, false, true));

        assertThat(resumo).contains("📊 Equipe hoje: 3h trabalhadas, 1 tarefa(s) concluída(s), 0 reunião(ões)");
    }
}
