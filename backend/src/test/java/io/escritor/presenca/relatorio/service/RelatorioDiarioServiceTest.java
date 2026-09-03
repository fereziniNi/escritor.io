package io.escritor.presenca.relatorio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.ponto.domain.EstadoDia;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.web.JornadaDoDiaResponse;
import java.time.Clock;
import java.time.Instant;
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
 * arquivo, ver esclarecimento) cobrindo ponto + tarefas juntos.
 */
@ExtendWith(MockitoExtension.class)
class RelatorioDiarioServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T18:00:00Z");

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private JornadaService jornadaService;

    @Mock
    private CardEventoRepository cardEventoRepository;

    private RelatorioDiarioService servico;

    @BeforeEach
    void setUp() {
        servico = new RelatorioDiarioService(usuarioRepository, jornadaService, cardEventoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
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

    @Test
    void tituloTrazADataDeHoje() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia();

        assertThat(resumo).startsWith("📋 Resumo do dia - 15/01/2026");
    }

    @Test
    void listaCadaUsuarioComHorasTrabalhadasEApontamento() {
        Usuario ana = usuarioComId("Ana Souza", 1L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(ana));
        when(jornadaService.jornadaDoDia(ana)).thenReturn(jornada(270, 90));
        when(cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(any(), any())).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia();

        assertThat(resumo).contains("👤 Ana Souza").contains("4h30 trabalhados").contains("90 min apontados em tarefas");
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

        String resumo = servico.montarResumoDoDia();

        assertThat(resumo).contains("👤 Ana Souza").contains("2 tarefa(s) criada(s), 1 movida(s)");
        assertThat(resumo).contains("👤 Beto Lima").contains("0 tarefa(s) criada(s), 1 movida(s)");
    }

    @Test
    void marcaSemAtividadeQuandoNaoTemNemPontoNemTarefa() {
        Usuario carlos = usuarioComId("Carlos Souza", 3L);
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(carlos));
        when(jornadaService.jornadaDoDia(carlos)).thenReturn(jornada(0, 0));
        when(cardEventoRepository.findByCriadoEmGreaterThanEqualAndCriadoEmLessThan(any(), any())).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia();

        assertThat(resumo).contains("👤 Carlos Souza").contains("sem atividade hoje");
    }

    @Test
    void semColaboradorCadastradoAvisaExplicitamente() {
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of());

        String resumo = servico.montarResumoDoDia();

        assertThat(resumo).contains("Nenhum colaborador cadastrado");
    }
}
