package io.escritor.presenca.ponto.notificacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Depois da extração de {@link EnvioWhatsApp} (compartilhado com o resumo diário), este teste só
 * cobre "qual texto" e "quando" - o "envia ou não"/"como" agora é responsabilidade de {@code
 * EnvioWhatsAppEvolution} (testado à parte, via `MockRestServiceServer`).
 */
@ExtendWith(MockitoExtension.class)
class NotificacaoPontoWhatsAppTest {

    // Construído a partir do horário de São Paulo de propósito - o texto é montado nesse fuso.
    private static final Instant MOMENTO =
            ZonedDateTime.of(2026, 1, 15, 12, 0, 0, 0, ZoneId.of("America/Sao_Paulo")).toInstant();

    @Mock
    private EnvioWhatsApp envioWhatsApp;

    private NotificacaoPontoWhatsApp servico;

    @BeforeEach
    void setUp() {
        servico = new NotificacaoPontoWhatsApp(envioWhatsApp);
    }

    private static Usuario usuario(String nome) {
        return new Usuario(nome, nome.toLowerCase() + "@escritor.io", Papel.COLABORADOR, 480);
    }

    @Test
    void montaTextoDeEntradaComNomeHoraEData() {
        servico.avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.ENTRADA, MOMENTO);

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(envioWhatsApp).enviarParaChefe(captor.capture());
        assertThat(captor.getValue()).contains("Ana Souza").contains("iniciou o trabalho às 12:00").contains("15/01/2026");
    }

    @Test
    void montaTextoDeSaidaComNomeHoraEData() {
        servico.avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.SAIDA, MOMENTO);

        verify(envioWhatsApp).enviarParaChefe(contains("encerrou o trabalho às 12:00"));
    }

    @Test
    void naoEnviaNadaParaPausaOuRetornoDePausa() {
        servico.avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.PAUSA_INICIO, MOMENTO);
        servico.avisarPonto(usuario("Ana Souza"), TipoRegistroPonto.PAUSA_FIM, MOMENTO);

        verify(envioWhatsApp, never()).enviarParaChefe(org.mockito.ArgumentMatchers.any());
    }
}
