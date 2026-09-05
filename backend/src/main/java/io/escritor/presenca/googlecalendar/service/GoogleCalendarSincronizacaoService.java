package io.escritor.presenca.googlecalendar.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Publica a escala efetiva do usuário (janela rolante de 60 dias a partir de hoje) como eventos no
 * Google Agenda dele mesmo - pedido do usuário: "algo muito parecido com o agenda do google...
 * ou ate mesmo integrar". Via de mão única: só escrevemos, nunca lemos o Google Agenda de volta.
 *
 * <p>O id de cada evento é determinístico ({@link #idDoEvento}), então não precisamos de uma
 * tabela de mapeamento local pra saber "qual evento do Google corresponde a qual dia da nossa
 * escala" - só recalculamos o id da mesma forma sempre. A Google aceita id customizado num evento
 * desde que bata com {@code [a-v0-9]{5,1024}} (base32hex minúsculo) - dígitos decimais e as letras
 * do prefixo "esc" cabem nessa faixa.
 */
@Service
public class GoogleCalendarSincronizacaoService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarSincronizacaoService.class);
    private static final long DIAS_JANELA_SINCRONIZACAO = 60;
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String URL_EVENTOS_BASE = "https://www.googleapis.com/calendar/v3/calendars";

    private final ContaGoogleCalendarRepository contaRepository;
    private final EscalaService escalaService;
    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String fusoHorario;
    private final Clock clock;

    public GoogleCalendarSincronizacaoService(
            ContaGoogleCalendarRepository contaRepository,
            EscalaService escalaService,
            RestClient.Builder restClientBuilder,
            @Value("${app.google.client-id}") String clientId,
            @Value("${app.google.client-secret}") String clientSecret,
            @Value("${app.google.fuso-horario}") String fusoHorario,
            Clock clock) {
        this.contaRepository = contaRepository;
        this.escalaService = escalaService;
        this.restClient = restClientBuilder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.fusoHorario = fusoHorario;
        this.clock = clock;
    }

    /** Disparado pelo controller após qualquer mutação na escala do próprio usuário (não fica
     * dentro de {@code EscalaService} de propósito - injetar esta classe lá de volta criaria uma
     * dependência circular, já que esta classe também depende de {@code EscalaService} pra ler a
     * escala efetiva). {@code @Async}: chama a API da Google pela rede, não deve atrasar a
     * resposta de quem só queria salvar a própria escala. Não faz nada (sem lançar) se o usuário
     * nunca conectou - a maioria nunca vai ter conectado. */
    @Async
    public void sincronizarSeConectado(Usuario usuario) {
        contaRepository.findByUsuario(usuario).ifPresent(conta -> sincronizarComTratamentoDeErro(usuario, conta));
    }

    /** Mesma sincronização, mas pra todo mundo que está conectado - usada pelo
     * {@code SincronizacaoGoogleScheduler} diário, pra manter a janela de 60 dias sempre
     * deslizando pra frente mesmo se ninguém tocar na própria escala por um tempo. */
    public void sincronizarTodosOsConectados() {
        List<ContaGoogleCalendar> contas = contaRepository.findAll();
        for (ContaGoogleCalendar conta : contas) {
            sincronizarComTratamentoDeErro(conta.getUsuario(), conta);
        }
    }

    private void sincronizarComTratamentoDeErro(Usuario usuario, ContaGoogleCalendar conta) {
        try {
            sincronizar(usuario, conta);
        } catch (RuntimeException erro) {
            log.warn("Falha ao sincronizar a escala do usuário {} com o Google Agenda", usuario.getId(), erro);
        }
    }

    private void sincronizar(Usuario usuario, ContaGoogleCalendar conta) {
        LocalDate hoje = LocalDate.now(clock);
        LocalDate fim = hoje.plusDays(DIAS_JANELA_SINCRONIZACAO);
        List<DiaEfetivoResponse> dias = escalaService.calcularEfetiva(usuario, hoje, fim);

        String accessToken = obterAccessToken(conta);
        for (DiaEfetivoResponse dia : dias) {
            String eventId = idDoEvento(usuario.getId(), dia.data());
            if (dia.trabalha() && dia.horaInicio() != null && dia.horaFim() != null) {
                upsertEvento(conta, accessToken, eventId, dia);
            } else {
                removerEvento(conta, accessToken, eventId);
            }
        }

        conta.registrarSincronizacao(Instant.now(clock));
        contaRepository.save(conta);
    }

    private static String idDoEvento(Long usuarioId, LocalDate data) {
        return "esc" + usuarioId + data.format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private void upsertEvento(ContaGoogleCalendar conta, String accessToken, String eventId, DiaEfetivoResponse dia) {
        Map<String, Object> corpo = corpoDoEvento(eventId, dia);
        try {
            restClient
                    .post()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events", conta.getCalendarioId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corpo)
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException.Conflict jaExiste) {
            restClient
                    .put()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events/{eventId}", conta.getCalendarioId(), eventId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corpo)
                    .retrieve()
                    .toBodilessEntity();
        }
    }

    private Map<String, Object> corpoDoEvento(String eventId, DiaEfetivoResponse dia) {
        String inicio = dia.data() + "T" + dia.horaInicio();
        String fim = dia.data() + "T" + dia.horaFim();
        return Map.of(
                "id", eventId,
                "summary", "Trabalho - escritor.io",
                "start", Map.of("dateTime", inicio, "timeZone", fusoHorario),
                "end", Map.of("dateTime", fim, "timeZone", fusoHorario));
    }

    private void removerEvento(ContaGoogleCalendar conta, String accessToken, String eventId) {
        try {
            restClient
                    .delete()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events/{eventId}", conta.getCalendarioId(), eventId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException.NotFound | HttpClientErrorException.Gone jaNaoExisteMais) {
            // não havia evento nesse dia (ou já tinha sido removido antes) - nada a fazer
        }
    }

    private String obterAccessToken(ContaGoogleCalendar conta) {
        MultiValueMap<String, String> corpo = new LinkedMultiValueMap<>();
        corpo.add("client_id", clientId);
        corpo.add("client_secret", clientSecret);
        corpo.add("refresh_token", conta.getRefreshToken());
        corpo.add("grant_type", "refresh_token");

        RespostaToken resposta = restClient
                .post()
                .uri(URL_TOKEN)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(corpo)
                .retrieve()
                .body(RespostaToken.class);
        if (resposta == null || resposta.accessToken() == null) {
            throw new IllegalStateException("Google não devolveu um access token na renovação");
        }
        return resposta.accessToken();
    }

    private record RespostaToken(@JsonProperty("access_token") String accessToken) {
    }
}
