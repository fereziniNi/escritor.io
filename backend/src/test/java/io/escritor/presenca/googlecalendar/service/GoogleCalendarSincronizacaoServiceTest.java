package io.escritor.presenca.googlecalendar.service;

import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GoogleCalendarSincronizacaoServiceTest {

    private static final Clock RELOGIO_FIXO = Clock.fixed(Instant.parse("2026-01-15T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDate HOJE = LocalDate.now(RELOGIO_FIXO);
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private record Ambiente(
            GoogleCalendarSincronizacaoService servico,
            ContaGoogleCalendarRepository contaRepository,
            EscalaService escalaService,
            MockRestServiceServer servidor) {
    }

    private static Ambiente montar() {
        ContaGoogleCalendarRepository contaRepository = mock(ContaGoogleCalendarRepository.class);
        EscalaService escalaService = mock(EscalaService.class);
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
        GoogleCalendarSincronizacaoService servico = new GoogleCalendarSincronizacaoService(
                contaRepository, escalaService, builder, "client-123", "segredo-456", "America/Sao_Paulo", RELOGIO_FIXO);
        return new Ambiente(servico, contaRepository, escalaService, servidor);
    }

    private static void mockarAccessToken(MockRestServiceServer servidor) {
        servidor.expect(requestTo(URL_TOKEN))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("""
                        {"access_token":"access-fresco"}
                        """, MediaType.APPLICATION_JSON));
    }

    @Test
    void naoFazNadaNemChamaAGooglePraQuemNuncaConectou() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(1L);
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.empty());

        ambiente.servico().sincronizarSeConectado(usuario);

        ambiente.servidor().verify(); // nenhuma expectativa registrada - só passa sem chamada nenhuma
    }

    @Test
    void criaUmEventoParaCadaDiaTrabalhadoComOIdDeterministico() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(7L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(eq(usuario), eq(HOJE), eq(HOJE.plusDays(30))))
                .thenReturn(List.of(new DiaEfetivoResponse(HOJE, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        mockarAccessToken(ambiente.servidor());
        String idEsperado = "esc7" + HOJE.format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events"))
                .andExpect(method(HttpMethod.POST))
                // regressão: `dia.horaInicio() + ""` (via `LocalTime.toString()`) omite os segundos
                // quando são ":00" ("12:00" em vez de "12:00:00") - a Google rejeitava isso com 400
                // Bad Request (RFC3339 exige o componente de segundos). O corpo aqui precisa vir
                // com ":00" explícito no fim de cada horário.
                .andExpect(content().json(
                        """
                        {"id":"%s","summary":"Trabalho - escritor.io",
                         "start":{"dateTime":"%sT09:00:00","timeZone":"America/Sao_Paulo"},
                         "end":{"dateTime":"%sT18:00:00","timeZone":"America/Sao_Paulo"}}
                        """
                                .formatted(idEsperado, HOJE, HOJE)))
                .andRespond(withStatus(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"id\":\"" + idEsperado + "\"}"));

        ambiente.servico().sincronizarSeConectado(usuario);

        ambiente.servidor().verify();
        verify(ambiente.contaRepository()).save(conta);
        assertThat(conta.getUltimaSincronizacaoEm()).isEqualTo(RELOGIO_FIXO.instant());
    }

    @Test
    void quandoOEventoJaExisteCaiParaAtualizarEmVezDeCriar() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(7L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any()))
                .thenReturn(List.of(new DiaEfetivoResponse(HOJE, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        mockarAccessToken(ambiente.servidor());
        String idEsperado = "esc7" + HOJE.format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.CONFLICT));
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events/" + idEsperado))
                .andExpect(method(HttpMethod.PUT))
                .andRespond(withSuccess());

        ambiente.servico().sincronizarSeConectado(usuario);

        ambiente.servidor().verify();
    }

    @Test
    void removeOEventoDeUmDiaQueParouDeSerTrabalhado() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(7L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any()))
                .thenReturn(List.of(new DiaEfetivoResponse(HOJE, false, null, null)));
        mockarAccessToken(ambiente.servidor());
        String idEsperado = "esc7" + HOJE.format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events/" + idEsperado))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)); // não existia mesmo - não deve lançar

        ambiente.servico().sincronizarSeConectado(usuario);

        ambiente.servidor().verify();
    }

    @Test
    void retentaComBackoffQuandoALimitacaoDeTaxaEhTransientaEDaCertoNaSegundaTentativa() {
        // pego contra a API de verdade nesta sessão: sincronizar vários dias em sequência sem
        // pausa nenhuma disparou 403 rateLimitExceeded, mesmo longe da cota diária - é um erro
        // transiente de rajada, a própria Google recomenda retentar com backoff.
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(7L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any()))
                .thenReturn(List.of(new DiaEfetivoResponse(HOJE, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        mockarAccessToken(ambiente.servidor());
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"error":{"errors":[{"domain":"usageLimits","reason":"rateLimitExceeded"}],"code":403}}
                                """));
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.CREATED));

        ambiente.servico().sincronizarSeConectado(usuario);

        ambiente.servidor().verify();
        // chegou até o fim (registrou a sincronização) - a segunda tentativa deu certo
        verify(ambiente.contaRepository()).save(conta);
    }

    @Test
    void naoRetentaUm403QueNaoEhLimiteDeTaxa() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(7L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any()))
                .thenReturn(List.of(new DiaEfetivoResponse(HOJE, true, LocalTime.of(9, 0), LocalTime.of(18, 0))));
        mockarAccessToken(ambiente.servidor());
        // só UMA expectativa registrada - se o código retentasse por engano, essa segunda chamada
        // não teria nenhuma resposta programada e o teste falharia
        ambiente.servidor()
                .expect(requestTo("https://www.googleapis.com/calendar/v3/calendars/primary/events"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"error":{"errors":[{"domain":"global","reason":"insufficientPermissions"}],"code":403}}
                                """));

        ambiente.servico().sincronizarSeConectado(usuario); // não deve lançar (erro é engolido e logado)

        ambiente.servidor().verify();
        // não chegou até o fim - a sincronização falhou de verdade, sem registrar sucesso
        verify(ambiente.contaRepository(), never()).save(any());
    }

    @Test
    void falhaAoFalarComAGoogleNaoPropagaAExcecao() {
        Ambiente ambiente = montar();
        Usuario usuario = usuarioComId(1L);
        ContaGoogleCalendar conta = new ContaGoogleCalendar(usuario, "refresh-abc", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findByUsuario(usuario)).thenReturn(Optional.of(conta));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any())).thenThrow(new RuntimeException("boom"));

        ambiente.servico().sincronizarSeConectado(usuario); // não deve lançar

        verify(ambiente.contaRepository(), never()).save(any());
    }

    @Test
    void sincronizarTodosOsConectadosPassaPorCadaContaExistente() {
        Ambiente ambiente = montar();
        Usuario usuario1 = usuarioComId(1L);
        Usuario usuario2 = usuarioComId(2L);
        ContaGoogleCalendar conta1 = new ContaGoogleCalendar(usuario1, "r1", RELOGIO_FIXO.instant());
        ContaGoogleCalendar conta2 = new ContaGoogleCalendar(usuario2, "r2", RELOGIO_FIXO.instant());
        when(ambiente.contaRepository().findAll()).thenReturn(List.of(conta1, conta2));
        when(ambiente.escalaService().calcularEfetiva(any(), any(), any())).thenReturn(List.of());
        mockarAccessToken(ambiente.servidor());
        mockarAccessToken(ambiente.servidor());

        ambiente.servico().sincronizarTodosOsConectados();

        verify(ambiente.contaRepository()).save(conta1);
        verify(ambiente.contaRepository()).save(conta2);
    }
}
