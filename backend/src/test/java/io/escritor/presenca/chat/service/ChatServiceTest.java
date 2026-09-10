package io.escritor.presenca.chat.service;

import io.escritor.presenca.chat.domain.AcessoNegadoAConversaException;
import io.escritor.presenca.chat.domain.Conversa;
import io.escritor.presenca.chat.domain.ConversaInvalidaException;
import io.escritor.presenca.chat.domain.ConversaParticipante;
import io.escritor.presenca.chat.domain.Mensagem;
import io.escritor.presenca.chat.domain.TipoConversa;
import io.escritor.presenca.chat.repository.ConversaParticipanteRepository;
import io.escritor.presenca.chat.repository.ConversaRepository;
import io.escritor.presenca.chat.repository.MensagemRepository;
import io.escritor.presenca.chat.web.ConversaResponse;
import io.escritor.presenca.chat.web.EnviarMensagemRequest;
import io.escritor.presenca.chat.web.MensagemResponse;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-15T12:00:00Z"), ZoneOffset.UTC);

    @Mock
    private ConversaRepository conversaRepository;

    @Mock
    private ConversaParticipanteRepository participanteRepository;

    @Mock
    private MensagemRepository mensagemRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PresencaWebSocketHandler presencaWebSocketHandler;

    private final Usuario eu = usuarioComId(1L);
    private final Usuario outro = usuarioComId(2L);

    private ChatService chatService;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Beto Lima " + id, "beto" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private static Conversa conversaComId(Long id, TipoConversa tipo) {
        Conversa conversa = new Conversa(tipo, RELOGIO_FIXO.instant());
        ReflectionTestUtils.setField(conversa, "id", id);
        return conversa;
    }

    @BeforeEach
    void setUp() {
        chatService = new ChatService(
                conversaRepository, participanteRepository, mensagemRepository, usuarioRepository, presencaWebSocketHandler,
                RELOGIO_FIXO);
    }

    /** Mocks comuns de {@code construirResposta} (sem mensagem ainda, ninguém leu nada) - só
     * evita repetir isso em todo teste que passa por {@code abrirConversaDireta}/
     * {@code listarMinhasConversas}. */
    private void mockarRespostaVazia() {
        when(mensagemRepository.findTopByConversaOrderByCriadoEmDesc(any())).thenReturn(Optional.empty());
        when(participanteRepository.findByConversaAndUsuario(any(), any())).thenReturn(Optional.empty());
        when(mensagemRepository.countByConversaAndCriadoEmAfter(any(), any())).thenReturn(0L);
    }

    @Test
    void abrirConversaDiretaConsigoMesmoLancaConversaInvalida() {
        assertThatThrownBy(() -> chatService.abrirConversaDireta(eu, eu.getId())).isInstanceOf(ConversaInvalidaException.class);
        verify(usuarioRepository, never()).findById(any());
    }

    @Test
    void abrirConversaDiretaComUsuarioInexistenteLancaRecursoNaoEncontrado() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.abrirConversaDireta(eu, 99L)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void abrirConversaDiretaCriaQuandoNaoExisteAinda() {
        when(usuarioRepository.findById(outro.getId())).thenReturn(Optional.of(outro));
        when(participanteRepository.findByUsuario(eu)).thenReturn(List.of());
        when(conversaRepository.save(any())).thenAnswer(chamada -> {
            Conversa conversa = chamada.getArgument(0);
            ReflectionTestUtils.setField(conversa, "id", 50L);
            return conversa;
        });
        when(participanteRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(participanteRepository.findByConversa(any()))
                .thenReturn(List.of(new ConversaParticipante(conversaComId(50L, TipoConversa.DIRETA), outro)));
        mockarRespostaVazia();

        ConversaResponse resultado = chatService.abrirConversaDireta(eu, outro.getId());

        assertThat(resultado.id()).isEqualTo(50L);
        assertThat(resultado.tipo()).isEqualTo(TipoConversa.DIRETA);
        assertThat(resultado.nome()).isEqualTo(outro.getNome());
        verify(conversaRepository).save(any());
        verify(participanteRepository, times(2)).save(any());
    }

    @Test
    void abrirConversaDiretaReaproveitaQuandoJaExiste() {
        Conversa existente = conversaComId(50L, TipoConversa.DIRETA);
        when(usuarioRepository.findById(outro.getId())).thenReturn(Optional.of(outro));
        when(participanteRepository.findByUsuario(eu)).thenReturn(List.of(new ConversaParticipante(existente, eu)));
        when(participanteRepository.existsByConversaAndUsuario(existente, outro)).thenReturn(true);
        when(participanteRepository.findByConversa(existente))
                .thenReturn(List.of(new ConversaParticipante(existente, eu), new ConversaParticipante(existente, outro)));
        mockarRespostaVazia();

        ConversaResponse resultado = chatService.abrirConversaDireta(eu, outro.getId());

        assertThat(resultado.id()).isEqualTo(50L);
        verify(conversaRepository, never()).save(any());
        verify(participanteRepository, never()).save(any());
    }

    @Test
    void enviarPersisteAtualizaLeituraDoAutorENotificaSoOsOutros() {
        Conversa conversa = conversaComId(50L, TipoConversa.DIRETA);
        ConversaParticipante participacaoAutor = new ConversaParticipante(conversa, eu);
        when(conversaRepository.findById(50L)).thenReturn(Optional.of(conversa));
        when(participanteRepository.findByConversaAndUsuario(conversa, eu)).thenReturn(Optional.of(participacaoAutor));
        when(mensagemRepository.save(any())).thenAnswer(chamada -> {
            Mensagem mensagem = chamada.getArgument(0);
            ReflectionTestUtils.setField(mensagem, "id", 900L);
            return mensagem;
        });
        when(participanteRepository.findByConversa(conversa))
                .thenReturn(List.of(participacaoAutor, new ConversaParticipante(conversa, outro)));

        MensagemResponse resposta = chatService.enviar(eu, 50L, new EnviarMensagemRequest("Oi, tudo bem?"));

        assertThat(resposta.id()).isEqualTo(900L);
        assertThat(resposta.texto()).isEqualTo("Oi, tudo bem?");
        assertThat(resposta.autorId()).isEqualTo(eu.getId());
        assertThat(participacaoAutor.getUltimaLeituraEm()).isEqualTo(RELOGIO_FIXO.instant());
        verify(presencaWebSocketHandler).avisarMensagem(eq(outro.getId()), any());
        verify(presencaWebSocketHandler, never()).avisarMensagem(eq(eu.getId()), any());
    }

    @Test
    void enviarEmConversaDiretaSemParticiparLancaAcessoNegado() {
        Conversa conversa = conversaComId(50L, TipoConversa.DIRETA);
        when(conversaRepository.findById(50L)).thenReturn(Optional.of(conversa));
        when(participanteRepository.findByConversaAndUsuario(conversa, eu)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> chatService.enviar(eu, 50L, new EnviarMensagemRequest("Oi")))
                .isInstanceOf(AcessoNegadoAConversaException.class);
        verify(mensagemRepository, never()).save(any());
    }

    @Test
    void enviarNaGeralSemParticiparAindaEntraSozinhoENaoQuebra() {
        Conversa geral = conversaComId(1L, TipoConversa.GERAL);
        when(conversaRepository.findById(1L)).thenReturn(Optional.of(geral));
        when(participanteRepository.findByConversaAndUsuario(geral, eu)).thenReturn(Optional.empty());
        when(participanteRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(mensagemRepository.save(any())).thenAnswer(chamada -> {
            Mensagem mensagem = chamada.getArgument(0);
            ReflectionTestUtils.setField(mensagem, "id", 901L);
            return mensagem;
        });
        when(participanteRepository.findByConversa(geral)).thenReturn(List.of(new ConversaParticipante(geral, eu)));

        MensagemResponse resposta = chatService.enviar(eu, 1L, new EnviarMensagemRequest("Bom dia a todos!"));

        assertThat(resposta.texto()).isEqualTo("Bom dia a todos!");
        verify(participanteRepository, times(2)).save(any()); // entra sozinho + marca a própria leitura
    }

    @Test
    void listarMinhasConversasGarantePresencaNaGeralECalculaNaoLidas() {
        Conversa geral = conversaComId(1L, TipoConversa.GERAL);
        ConversaParticipante participacao = new ConversaParticipante(geral, eu);
        when(conversaRepository.findByTipo(TipoConversa.GERAL)).thenReturn(Optional.of(geral));
        when(participanteRepository.existsByConversaAndUsuario(geral, eu)).thenReturn(false);
        when(participanteRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(participanteRepository.findByUsuario(eu)).thenReturn(List.of(participacao));
        when(mensagemRepository.findTopByConversaOrderByCriadoEmDesc(geral)).thenReturn(Optional.empty());
        when(participanteRepository.findByConversaAndUsuario(geral, eu)).thenReturn(Optional.of(participacao));
        when(mensagemRepository.countByConversaAndCriadoEmAfter(geral, Instant.EPOCH)).thenReturn(3L);

        List<ConversaResponse> resultado = chatService.listarMinhasConversas(eu);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).tipo()).isEqualTo(TipoConversa.GERAL);
        assertThat(resultado.get(0).nome()).isEqualTo("Geral");
        assertThat(resultado.get(0).naoLidas()).isEqualTo(3L);
        verify(participanteRepository).save(any());
    }

    @Test
    void listarMensagensDevolveEmOrdemCronologicaAscendente() {
        Conversa conversa = conversaComId(50L, TipoConversa.DIRETA);
        ConversaParticipante participacao = new ConversaParticipante(conversa, eu);
        when(conversaRepository.findById(50L)).thenReturn(Optional.of(conversa));
        when(participanteRepository.findByConversaAndUsuario(conversa, eu)).thenReturn(Optional.of(participacao));
        Mensagem maisNova = new Mensagem(conversa, outro, "Depois", Instant.parse("2026-01-15T12:00:00Z"));
        ReflectionTestUtils.setField(maisNova, "id", 2L);
        Mensagem maisAntiga = new Mensagem(conversa, eu, "Antes", Instant.parse("2026-01-15T11:00:00Z"));
        ReflectionTestUtils.setField(maisAntiga, "id", 1L);
        when(mensagemRepository.findTop100ByConversaOrderByCriadoEmDesc(conversa)).thenReturn(List.of(maisNova, maisAntiga));

        List<MensagemResponse> resultado = chatService.listarMensagens(eu, 50L);

        assertThat(resultado).extracting(MensagemResponse::texto).containsExactly("Antes", "Depois");
    }

    @Test
    void marcarComoLidaAtualizaAPropriaParticipacao() {
        Conversa conversa = conversaComId(50L, TipoConversa.DIRETA);
        ConversaParticipante participacao = new ConversaParticipante(conversa, eu);
        when(conversaRepository.findById(50L)).thenReturn(Optional.of(conversa));
        when(participanteRepository.findByConversaAndUsuario(conversa, eu)).thenReturn(Optional.of(participacao));

        chatService.marcarComoLida(eu, 50L);

        assertThat(participacao.getUltimaLeituraEm()).isEqualTo(RELOGIO_FIXO.instant());
        verify(participanteRepository).save(participacao);
    }
}
