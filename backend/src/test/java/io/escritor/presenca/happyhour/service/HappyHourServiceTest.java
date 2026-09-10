package io.escritor.presenca.happyhour.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.happyhour.domain.AtividadeHappyHour;
import io.escritor.presenca.happyhour.domain.NenhumaAtividadeParaSortearException;
import io.escritor.presenca.happyhour.repository.AtividadeHappyHourRepository;
import io.escritor.presenca.happyhour.web.AtividadeResponse;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HappyHourServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-13T19:00:00Z"), ZoneOffset.UTC);

    @Mock
    private AtividadeHappyHourRepository atividadeHappyHourRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PresencaWebSocketHandler presencaWebSocketHandler;

    @Mock
    private NotificacaoService notificacaoService;

    private final Usuario autor = usuarioComId(1L, "Ana Souza");

    private HappyHourService service;

    private static Usuario usuarioComId(Long id, String nome) {
        Usuario usuario = new Usuario(nome, "usuario" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static AtividadeHappyHour atividadeComId(Long id, String descricao, Usuario sugerida) {
        AtividadeHappyHour atividade = new AtividadeHappyHour(descricao, sugerida, Instant.parse("2026-01-13T18:00:00Z"));
        ReflectionTestUtils.setField(atividade, "id", id);
        return atividade;
    }

    @BeforeEach
    void setUp() {
        // seed fixo (0) - com uma lista de 1 item `nextInt(1)` sempre devolve 0 de qualquer forma,
        // mas fixar deixa explícito que o teste não depende de aleatoriedade de verdade.
        service = new HappyHourService(
                atividadeHappyHourRepository, usuarioRepository, presencaWebSocketHandler, notificacaoService, RELOGIO_FIXO, new Random(0));
    }

    @Test
    void listarDevolveAsAtividadesNaOrdemDoRepositorio() {
        AtividadeHappyHour atividade = atividadeComId(1L, "Karaokê", autor);
        when(atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc()).thenReturn(List.of(atividade));

        List<AtividadeResponse> resposta = service.listar();

        assertThat(resposta).hasSize(1);
        assertThat(resposta.get(0).descricao()).isEqualTo("Karaokê");
    }

    @Test
    void sugerirSalvaComADataDoRelogio() {
        when(atividadeHappyHourRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        AtividadeResponse resposta = service.sugerir("Boliche", autor);

        assertThat(resposta.descricao()).isEqualTo("Boliche");
        assertThat(resposta.criadaEm()).isEqualTo(RELOGIO_FIXO.instant());
        assertThat(resposta.sugeridaPorNome()).isEqualTo("Ana Souza");
        assertThat(resposta.sorteadaEm()).isNull();
    }

    @Test
    void sortearComListaVaziaLancaExcecao() {
        when(atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc()).thenReturn(List.of());

        assertThatThrownBy(() -> service.sortear(autor)).isInstanceOf(NenhumaAtividadeParaSortearException.class);
        verify(presencaWebSocketHandler, never()).avisarSorteioHappyHour(any());
    }

    @Test
    void sortearComUmaSoAtividadeEscolheElaEAvisaTodoMundo() {
        AtividadeHappyHour unica = atividadeComId(1L, "Karaokê", autor);
        Usuario outro = usuarioComId(2L, "Beto Lima");
        when(atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc()).thenReturn(List.of(unica));
        when(atividadeHappyHourRepository.findBySorteadaEmIsNotNull()).thenReturn(Optional.empty());
        when(atividadeHappyHourRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(usuarioRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(autor, outro));

        AtividadeResponse resposta = service.sortear(autor);

        assertThat(resposta.id()).isEqualTo(1L);
        assertThat(unica.getSorteadaEm()).isEqualTo(RELOGIO_FIXO.instant());
        var captor = ArgumentCaptor.forClass(PresencaWebSocketHandler.SorteioHappyHourWs.class);
        verify(presencaWebSocketHandler).avisarSorteioHappyHour(captor.capture());
        assertThat(captor.getValue().atividadeId()).isEqualTo(1L);
        assertThat(captor.getValue().descricao()).isEqualTo("Karaokê");
        assertThat(captor.getValue().sorteadoPorNome()).isEqualTo("Ana Souza");
        // pedido do usuário: "ver as últimas que chegaram no sistema" - inclui até quem girou,
        // mesmo espírito do broadcast em tempo real (que também avisa quem sorteou).
        verify(notificacaoService).registrar(eq(autor), eq(TipoNotificacao.SORTEIO_HAPPY_HOUR), any(), isNull());
        verify(notificacaoService).registrar(eq(outro), eq(TipoNotificacao.SORTEIO_HAPPY_HOUR), any(), isNull());
    }

    @Test
    void sortearDesmarcaOSorteioAnteriorAntesDeMarcarUmNovo() {
        AtividadeHappyHour anteriorSorteada = atividadeComId(1L, "Karaokê", autor);
        anteriorSorteada.sortear(Instant.parse("2026-01-10T19:00:00Z"));
        when(atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc()).thenReturn(List.of(anteriorSorteada));
        when(atividadeHappyHourRepository.findBySorteadaEmIsNotNull()).thenReturn(Optional.of(anteriorSorteada));
        lenient().when(atividadeHappyHourRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.sortear(autor);

        // mesma atividade (única na lista) - acaba re-sorteada com o novo horário, não fica com o
        // antigo nem null.
        assertThat(anteriorSorteada.getSorteadaEm()).isEqualTo(RELOGIO_FIXO.instant());
    }

    @Test
    void sorteioAtualComAlgumaAtividadeMarcadaRetornaEla() {
        AtividadeHappyHour sorteada = atividadeComId(2L, "Boliche", autor);
        sorteada.sortear(Instant.parse("2026-01-13T19:00:00Z"));
        when(atividadeHappyHourRepository.findBySorteadaEmIsNotNull()).thenReturn(Optional.of(sorteada));

        Optional<AtividadeResponse> resposta = service.sorteioAtual();

        assertThat(resposta).isPresent();
        assertThat(resposta.get().descricao()).isEqualTo("Boliche");
    }

    @Test
    void sorteioAtualSemNadaMarcadoRetornaVazio() {
        when(atividadeHappyHourRepository.findBySorteadaEmIsNotNull()).thenReturn(Optional.empty());

        assertThat(service.sorteioAtual()).isEmpty();
    }
}
