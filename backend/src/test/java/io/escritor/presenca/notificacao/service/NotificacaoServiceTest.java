package io.escritor.presenca.notificacao.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.notificacao.domain.Notificacao;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.repository.NotificacaoRepository;
import io.escritor.presenca.notificacao.web.NotificacoesResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pedido do usuário: "Não achei a parte da notificação dentro do sistema... quero ver as últimas
 * que chegaram no sistema" - ver {@code Notificacao} pro porquê disso existir.
 */
@ExtendWith(MockitoExtension.class)
class NotificacaoServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T12:00:00Z");

    @Mock
    private NotificacaoRepository notificacaoRepository;

    private NotificacaoService service;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        service = new NotificacaoService(notificacaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", 1L);
    }

    private static Notificacao notificacaoComId(Usuario destinatario, TipoNotificacao tipo, String texto, boolean lida, Long id) {
        Notificacao notificacao = new Notificacao(destinatario, tipo, texto, null, AGORA);
        if (lida) {
            notificacao.marcarComoLida();
        }
        ReflectionTestUtils.setField(notificacao, "id", id);
        return notificacao;
    }

    @Test
    void registrarSalvaComADataDoRelogioENaoLida() {
        service.registrar(usuario, TipoNotificacao.NOVA_TAREFA, "Ana criou a tarefa \"Corrigir bug\"", null);

        var captor = ArgumentCaptor.forClass(Notificacao.class);
        verify(notificacaoRepository).save(captor.capture());
        assertThat(captor.getValue().getDestinatario()).isSameAs(usuario);
        assertThat(captor.getValue().getTipo()).isEqualTo(TipoNotificacao.NOVA_TAREFA);
        assertThat(captor.getValue().getTexto()).isEqualTo("Ana criou a tarefa \"Corrigir bug\"");
        assertThat(captor.getValue().getLink()).isNull();
        assertThat(captor.getValue().isLida()).isFalse();
        assertThat(captor.getValue().getCriadoEm()).isEqualTo(AGORA);
    }

    @Test
    void registrarComLinkGravaOLink() {
        service.registrar(usuario, TipoNotificacao.CONVITE_REUNIAO, "Ana te chamou", "https://meet.google.com/abc-defg-hij");

        var captor = ArgumentCaptor.forClass(Notificacao.class);
        verify(notificacaoRepository).save(captor.capture());
        assertThat(captor.getValue().getLink()).isEqualTo("https://meet.google.com/abc-defg-hij");
    }

    @Test
    void listarMinhasDevolveAsUltimasEAContagemDeNaoLidas() {
        Notificacao lida = notificacaoComId(usuario, TipoNotificacao.NOVA_TAREFA, "Tarefa nova", true, 1L);
        Notificacao naoLida = notificacaoComId(usuario, TipoNotificacao.TAREFA_CONCLUIDA, "Tarefa concluída", false, 2L);
        when(notificacaoRepository.findTop30ByDestinatarioOrderByCriadoEmDesc(usuario)).thenReturn(List.of(naoLida, lida));
        when(notificacaoRepository.countByDestinatarioAndLidaFalse(usuario)).thenReturn(1L);

        NotificacoesResponse resposta = service.listarMinhas(usuario);

        assertThat(resposta.itens()).hasSize(2);
        assertThat(resposta.itens().get(0).texto()).isEqualTo("Tarefa concluída");
        assertThat(resposta.itens().get(0).lida()).isFalse();
        assertThat(resposta.itens().get(1).lida()).isTrue();
        assertThat(resposta.naoLidas()).isEqualTo(1L);
    }

    @Test
    void marcarTodasComoLidasSoTocaNasQueEstavamNaoLidas() {
        Notificacao naoLida1 = notificacaoComId(usuario, TipoNotificacao.NOVA_TAREFA, "Tarefa 1", false, 1L);
        Notificacao naoLida2 = notificacaoComId(usuario, TipoNotificacao.SORTEIO_HAPPY_HOUR, "Roleta", false, 2L);
        when(notificacaoRepository.findByDestinatarioAndLidaFalse(usuario)).thenReturn(List.of(naoLida1, naoLida2));

        service.marcarTodasComoLidas(usuario);

        assertThat(naoLida1.isLida()).isTrue();
        assertThat(naoLida2.isLida()).isTrue();
        verify(notificacaoRepository).saveAll(List.of(naoLida1, naoLida2));
    }
}
