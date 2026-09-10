package io.escritor.presenca.googlecalendar.service;

import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.reuniao.domain.Reuniao;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GoogleMeetServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T12:00:00Z");
    private static final LocalDate DIA = LocalDate.of(2026, 1, 20);
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String URL_EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    private static Usuario usuarioComId(Long id, String email) {
        Usuario usuario = new Usuario("Usuário " + id, email, Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private record Ambiente(GoogleMeetService servico, ContaGoogleCalendarRepository contaRepository, MockRestServiceServer servidor) {
    }

    private static Ambiente montar() {
        ContaGoogleCalendarRepository contaRepository = mock(ContaGoogleCalendarRepository.class);
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
        GoogleMeetService servico = new GoogleMeetService(contaRepository, builder, "client-123", "segredo-456", "America/Sao_Paulo");
        return new Ambiente(servico, contaRepository, servidor);
    }

    private static void mockarAccessToken(MockRestServiceServer servidor) {
        servidor.expect(requestTo(URL_TOKEN))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"access_token":"access-fresco"}
                        """, MediaType.APPLICATION_JSON));
    }

    private static Reuniao reuniaoComId(Long id, Usuario criador, List<Usuario> participantes) {
        Reuniao reuniao = new Reuniao(criador, participantes, DIA, LocalTime.of(14, 30), LocalTime.of(15, 0), "Alinhamento", AGORA);
        ReflectionTestUtils.setField(reuniao, "id", id);
        return reuniao;
    }

    @Test
    void criaOEventoComConferenceDataEAttendeesEDevolveOHangoutLink() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        Usuario participante = usuarioComId(2L, "colega@escritor.io");
        ContaGoogleCalendar conta = new ContaGoogleCalendar(criador, "refresh-abc", AGORA);
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.of(conta));
        Reuniao reuniao = reuniaoComId(42L, criador, List.of(participante));
        mockarAccessToken(ambiente.servidor());
        ambiente.servidor()
                .expect(requestTo(URL_EVENTOS + "?conferenceDataVersion=1&sendUpdates=all"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().json(
                        """
                        {"id":"reu42","summary":"Alinhamento",
                         "start":{"dateTime":"2026-01-20T14:30:00","timeZone":"America/Sao_Paulo"},
                         "end":{"dateTime":"2026-01-20T15:00:00","timeZone":"America/Sao_Paulo"},
                         "attendees":[{"email":"colega@escritor.io"}],
                         "conferenceData":{"createRequest":{"conferenceSolutionKey":{"type":"hangoutsMeet"}}}}
                        """))
                .andRespond(withStatus(HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"id":"reu42","hangoutLink":"https://meet.google.com/abc-defg-hij"}
                                """));

        String link = ambiente.servico().criarEventoComMeet(criador, reuniao);

        assertThat(link).isEqualTo("https://meet.google.com/abc-defg-hij");
        ambiente.servidor().verify();
    }

    @Test
    void criarEventoSemContaConectadaLancaGoogleNaoConectado() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.empty());
        Reuniao reuniao = reuniaoComId(42L, criador, List.of(usuarioComId(2L, "colega@escritor.io")));

        assertThatThrownBy(() -> ambiente.servico().criarEventoComMeet(criador, reuniao))
                .isInstanceOf(GoogleNaoConectadoException.class);
    }

    @Test
    void retentaComBackoffQuandoALimitacaoDeTaxaEhTransientaEDaCertoNaSegundaTentativa() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        ContaGoogleCalendar conta = new ContaGoogleCalendar(criador, "refresh-abc", AGORA);
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.of(conta));
        Reuniao reuniao = reuniaoComId(42L, criador, List.of(usuarioComId(2L, "colega@escritor.io")));
        mockarAccessToken(ambiente.servidor());
        ambiente.servidor()
                .expect(requestTo(URL_EVENTOS + "?conferenceDataVersion=1&sendUpdates=all"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"error":{"errors":[{"domain":"usageLimits","reason":"rateLimitExceeded"}],"code":403}}
                                """));
        ambiente.servidor()
                .expect(requestTo(URL_EVENTOS + "?conferenceDataVersion=1&sendUpdates=all"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.OK)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"hangoutLink":"https://meet.google.com/abc-defg-hij"}
                                """));

        String link = ambiente.servico().criarEventoComMeet(criador, reuniao);

        assertThat(link).isEqualTo("https://meet.google.com/abc-defg-hij");
        ambiente.servidor().verify();
    }

    @Test
    void removerEventoDeletaPeloIdDeterministico() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        ContaGoogleCalendar conta = new ContaGoogleCalendar(criador, "refresh-abc", AGORA);
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.of(conta));
        mockarAccessToken(ambiente.servidor());
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events/reu42"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));

        ambiente.servico().removerEvento(criador, 42L);

        ambiente.servidor().verify();
    }

    @Test
    void removerEventoDeQuemNuncaConectouNaoFazNada() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.empty());

        ambiente.servico().removerEvento(criador, 42L);

        ambiente.servidor().verify(); // nenhuma expectativa registrada - só passa sem chamada nenhuma
    }

    @Test
    void removerEventoQueJaNaoExisteNaoLanca() {
        Ambiente ambiente = montar();
        Usuario criador = usuarioComId(1L, "chefe@escritor.io");
        ContaGoogleCalendar conta = new ContaGoogleCalendar(criador, "refresh-abc", AGORA);
        when(ambiente.contaRepository().findByUsuario(criador)).thenReturn(Optional.of(conta));
        mockarAccessToken(ambiente.servidor());
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events/reu42"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        ambiente.servico().removerEvento(criador, 42L);

        ambiente.servidor().verify();
    }
}
