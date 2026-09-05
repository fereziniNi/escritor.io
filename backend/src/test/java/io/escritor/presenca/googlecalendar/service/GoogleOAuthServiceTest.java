package io.escritor.presenca.googlecalendar.service;

import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.domain.EstadoOAuthGoogle;
import io.escritor.presenca.googlecalendar.domain.EstadoOAuthInvalidoException;
import io.escritor.presenca.googlecalendar.domain.GoogleIntegracaoDesabilitadaException;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.googlecalendar.repository.EstadoOAuthGoogleRepository;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GoogleOAuthServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-15T12:00:00Z"), ZoneOffset.UTC);

    private ContaGoogleCalendarRepository contaRepository;
    private EstadoOAuthGoogleRepository estadoRepository;
    private MockRestServiceServer servidor;
    private GoogleOAuthService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private GoogleOAuthService montar(String clientId, String clientSecret) {
        contaRepository = org.mockito.Mockito.mock(ContaGoogleCalendarRepository.class);
        estadoRepository = org.mockito.Mockito.mock(EstadoOAuthGoogleRepository.class);
        RestClient.Builder builder = RestClient.builder();
        servidor = MockRestServiceServer.bindTo(builder).build();
        return new GoogleOAuthService(
                contaRepository,
                estadoRepository,
                builder,
                clientId,
                clientSecret,
                "http://127.0.0.1:5175/integracoes/google/callback",
                RELOGIO_FIXO);
    }

    @BeforeEach
    void setUp() {
        service = montar("client-123", "segredo-456");
    }

    @Test
    void habilitadoFalsoSemClientIdOuSecret() {
        assertThat(montar("", "segredo").habilitado()).isFalse();
        assertThat(montar("client", "").habilitado()).isFalse();
        assertThat(montar("client", "segredo").habilitado()).isTrue();
    }

    @Test
    void iniciarConexaoLancaQuandoDesabilitado() {
        GoogleOAuthService desabilitado = montar("", "");
        Usuario usuario = usuarioComId(1L);

        assertThatThrownBy(() -> desabilitado.iniciarConexao(usuario)).isInstanceOf(GoogleIntegracaoDesabilitadaException.class);
    }

    @Test
    void iniciarConexaoSalvaEstadoEMontaUrlDeAutorizacaoComOsParametrosCertos() {
        Usuario usuario = usuarioComId(1L);

        String url = service.iniciarConexao(usuario);

        ArgumentCaptor<EstadoOAuthGoogle> captor = ArgumentCaptor.forClass(EstadoOAuthGoogle.class);
        verify(estadoRepository).save(captor.capture());
        EstadoOAuthGoogle salvo = captor.getValue();
        assertThat(salvo.getUsuario()).isEqualTo(usuario);
        assertThat(salvo.estaExpirado(RELOGIO_FIXO.instant())).isFalse();

        URI uri = URI.create(url);
        var params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        assertThat(uri.toString()).startsWith("https://accounts.google.com/o/oauth2/v2/auth");
        assertThat(params.getFirst("client_id")).isEqualTo("client-123");
        assertThat(params.getFirst("redirect_uri")).isEqualTo("http://127.0.0.1:5175/integracoes/google/callback");
        assertThat(params.getFirst("scope")).isEqualTo("https://www.googleapis.com/auth/calendar.events");
        assertThat(params.getFirst("access_type")).isEqualTo("offline");
        assertThat(params.getFirst("prompt")).isEqualTo("consent");
        assertThat(params.getFirst("state")).isEqualTo(salvo.getNonce());
    }

    @Test
    void tratarCallbackComStateInexistenteLancaEstadoInvalido() {
        when(estadoRepository.findById("nonce-fantasma")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.tratarCallback("codigo", "nonce-fantasma"))
                .isInstanceOf(EstadoOAuthInvalidoException.class);
    }

    @Test
    void tratarCallbackComStateExpiradoLancaEstadoInvalidoEApagaOEstadoMesmoAssim() {
        Usuario usuario = usuarioComId(1L);
        EstadoOAuthGoogle expirado =
                new EstadoOAuthGoogle("nonce-velho", usuario, RELOGIO_FIXO.instant().minusSeconds(1), RELOGIO_FIXO.instant().minusSeconds(700));
        when(estadoRepository.findById("nonce-velho")).thenReturn(Optional.of(expirado));

        assertThatThrownBy(() -> service.tratarCallback("codigo", "nonce-velho")).isInstanceOf(EstadoOAuthInvalidoException.class);

        verify(estadoRepository).delete(expirado);
    }

    @Test
    void tratarCallbackDeUmaPrimeiraConexaoCriaAContaComORefreshToken() {
        Usuario usuario = usuarioComId(1L);
        EstadoOAuthGoogle estado = new EstadoOAuthGoogle("nonce-1", usuario, RELOGIO_FIXO.instant().plusSeconds(60), RELOGIO_FIXO.instant());
        when(estadoRepository.findById("nonce-1")).thenReturn(Optional.of(estado));
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.empty());
        servidor.expect(requestTo("https://oauth2.googleapis.com/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(
                        """
                        {"access_token":"access-1","refresh_token":"refresh-1","expires_in":3600}
                        """,
                        MediaType.APPLICATION_JSON));

        service.tratarCallback("codigo-1", "nonce-1");

        ArgumentCaptor<ContaGoogleCalendar> captor = ArgumentCaptor.forClass(ContaGoogleCalendar.class);
        verify(contaRepository).save(captor.capture());
        assertThat(captor.getValue().getRefreshToken()).isEqualTo("refresh-1");
        assertThat(captor.getValue().getUsuario()).isEqualTo(usuario);
        verify(estadoRepository).delete(estado);
        servidor.verify();
    }

    @Test
    void tratarCallbackDeUmaPrimeiraConexaoSemRefreshTokenNaRespostaLancaErro() {
        Usuario usuario = usuarioComId(1L);
        EstadoOAuthGoogle estado = new EstadoOAuthGoogle("nonce-2", usuario, RELOGIO_FIXO.instant().plusSeconds(60), RELOGIO_FIXO.instant());
        when(estadoRepository.findById("nonce-2")).thenReturn(Optional.of(estado));
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.empty());
        servidor.expect(requestTo("https://oauth2.googleapis.com/token"))
                .andRespond(withSuccess("""
                        {"access_token":"access-1","expires_in":3600}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.tratarCallback("codigo-2", "nonce-2")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void tratarCallbackDeUmaReconexaoSemRefreshTokenNovoMantemOAntigo() {
        Usuario usuario = usuarioComId(1L);
        ContaGoogleCalendar contaExistente = new ContaGoogleCalendar(usuario, "refresh-antigo", RELOGIO_FIXO.instant());
        EstadoOAuthGoogle estado = new EstadoOAuthGoogle("nonce-3", usuario, RELOGIO_FIXO.instant().plusSeconds(60), RELOGIO_FIXO.instant());
        when(estadoRepository.findById("nonce-3")).thenReturn(Optional.of(estado));
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.of(contaExistente));
        servidor.expect(requestTo("https://oauth2.googleapis.com/token"))
                .andRespond(withSuccess("""
                        {"access_token":"access-novo","expires_in":3600}
                        """, MediaType.APPLICATION_JSON));

        service.tratarCallback("codigo-3", "nonce-3");

        verify(contaRepository).save(contaExistente);
        assertThat(contaExistente.getRefreshToken()).isEqualTo("refresh-antigo");
    }

    @Test
    void desconectarRevogaNaGoogleEApagaAConta() {
        Usuario usuario = usuarioComId(1L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-x", RELOGIO_FIXO.instant());
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.of(conta));
        servidor.expect(requestTo("https://oauth2.googleapis.com/revoke?token=refresh-x"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess());

        service.desconectar(usuario);

        verify(contaRepository).delete(conta);
        servidor.verify();
    }

    @Test
    void desconectarApagaAContaMesmoSeARevogacaoNaGoogleFalhar() {
        Usuario usuario = usuarioComId(1L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-y", RELOGIO_FIXO.instant());
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.of(conta));
        servidor.expect(requestTo("https://oauth2.googleapis.com/revoke?token=refresh-y")).andRespond(withServerError());

        service.desconectar(usuario);

        verify(contaRepository).delete(conta);
    }

    @Test
    void desconectarSemContaConectadaNaoFazNadaESemChamarAGoogle() {
        Usuario usuario = usuarioComId(1L);
        when(contaRepository.findByUsuario(usuario)).thenReturn(Optional.empty());

        service.desconectar(usuario);

        verify(contaRepository, never()).delete(any());
        servidor.verify(); // nenhuma expectativa registrada - passa só se nenhuma chamada foi feita
    }

    @Test
    void estaConectadoReflecteExistenciaDaConta() {
        Usuario usuario = usuarioComId(1L);
        when(contaRepository.findByUsuario(usuario))
                .thenReturn(Optional.of(new ContaGoogleCalendar(usuario, "x", RELOGIO_FIXO.instant())))
                .thenReturn(Optional.empty());

        assertThat(service.estaConectado(usuario)).isTrue();
        assertThat(service.estaConectado(usuario)).isFalse();
        verify(contaRepository, times(2)).findByUsuario(usuario);
    }
}
