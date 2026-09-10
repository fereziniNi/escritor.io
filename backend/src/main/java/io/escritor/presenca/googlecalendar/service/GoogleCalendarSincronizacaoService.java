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
import java.time.LocalTime;
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
 * Publica a escala efetiva do usuário (janela rolante de 30 dias a partir de hoje) como eventos no
 * Google Agenda dele mesmo - pedido do usuário: "algo muito parecido com o agenda do google...
 * ou ate mesmo integrar". Via de mão única: só escrevemos, nunca lemos o Google Agenda de volta.
 *
 * <p>O id de cada evento é determinístico ({@link #idDoEvento}), então não precisamos de uma
 * tabela de mapeamento local pra saber "qual evento do Google corresponde a qual dia da nossa
 * escala" - só recalculamos o id da mesma forma sempre. A Google aceita id customizado num evento
 * desde que bata com {@code [a-v0-9]{5,1024}} (base32hex minúsculo) - dígitos decimais e as letras
 * do prefixo "esc" cabem nessa faixa.
 *
 * <p>Cada dia da janela é uma requisição HTTP separada (sem tabela de mapeamento, não dá pra saber
 * de antemão se é insert/update/no-op) - contra a API de verdade isso já disparou 403
 * {@code rateLimitExceeded} num teste real desta sessão (30-60 requisições em sequência, sem
 * intervalo nenhum, estoura o limite de rajada da Google mesmo sem chegar perto da cota diária).
 * Por isso {@link #ATRASO_ENTRE_REQUISICOES_MS} entre cada dia e {@link #comRetentativa} com
 * backoff exponencial especificamente pra esse erro (é transiente - a própria Google recomenda
 * retentar com backoff, não é um erro de configuração pra desistir na primeira).
 */
@Service
public class GoogleCalendarSincronizacaoService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarSincronizacaoService.class);
    private static final long DIAS_JANELA_SINCRONIZACAO = 30;
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String URL_EVENTOS_BASE = "https://www.googleapis.com/calendar/v3/calendars";
    // `LocalTime.toString()` omite os segundos quando são ":00" (ex.: 12:00:00 vira "12:00") - a
    // Google rejeita isso com 400 Bad Request, exige RFC3339 completo (HH:mm:ss). Formatter
    // explícito em vez de `dia.horaInicio().toString()`/concatenação direta.
    private static final DateTimeFormatter FORMATO_HORA_COM_SEGUNDOS = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final long ATRASO_ENTRE_REQUISICOES_MS = 150;
    private static final int MAXIMO_TENTATIVAS = 4;
    private static final long ATRASO_BASE_RETENTATIVA_MS = 1000;

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
                Map<String, Object> corpo = corpoDoEvento(eventId, "Trabalho - escritor.io", dia.data(), dia.horaInicio(), dia.horaFim());
                upsertEvento(conta, accessToken, eventId, corpo);
            } else {
                removerEvento(conta, accessToken, eventId);
            }
            dormir(ATRASO_ENTRE_REQUISICOES_MS);
        }

        conta.registrarSincronizacao(Instant.now(clock));
        contaRepository.save(conta);
    }

    private static String idDoEvento(Long usuarioId, LocalDate data) {
        return "esc" + usuarioId + data.format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private void upsertEvento(ContaGoogleCalendar conta, String accessToken, String eventId, Map<String, Object> corpo) {
        try {
            comRetentativa(() -> restClient
                    .post()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events", conta.getCalendarioId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corpo)
                    .retrieve()
                    .toBodilessEntity());
        } catch (HttpClientErrorException.Conflict jaExiste) {
            comRetentativa(() -> restClient
                    .put()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events/{eventId}", conta.getCalendarioId(), eventId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(corpo)
                    .retrieve()
                    .toBodilessEntity());
        }
    }

    /** {@code 403 rateLimitExceeded}/{@code userRateLimitExceeded} são erros transientes de rajada
     * (não de cota diária nem de permissão) - a própria Google recomenda retentar com backoff
     * exponencial em vez de desistir na primeira. Qualquer outro erro (incluindo outros 403, tipo
     * permissão insuficiente) propaga direto, sem retentar - não adianta insistir num erro que não
     * vai se resolver sozinho. */
    private static void comRetentativa(Runnable acao) {
        for (int tentativa = 1; tentativa <= MAXIMO_TENTATIVAS; tentativa++) {
            try {
                acao.run();
                return;
            } catch (HttpClientErrorException.Forbidden erro) {
                if (tentativa == MAXIMO_TENTATIVAS || !ehLimiteDeTaxa(erro)) {
                    throw erro;
                }
                dormir(ATRASO_BASE_RETENTATIVA_MS * (1L << (tentativa - 1)));
            }
        }
    }

    private static boolean ehLimiteDeTaxa(HttpClientErrorException.Forbidden erro) {
        String corpo = erro.getResponseBodyAsString();
        return corpo.contains("rateLimitExceeded") || corpo.contains("userRateLimitExceeded");
    }

    private static void dormir(long milissegundos) {
        try {
            Thread.sleep(milissegundos);
        } catch (InterruptedException interrompido) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Sincronização com o Google Agenda interrompida", interrompido);
        }
    }

    private Map<String, Object> corpoDoEvento(String eventId, String summary, LocalDate data, LocalTime horaInicio, LocalTime horaFim) {
        String inicio = data + "T" + horaInicio.format(FORMATO_HORA_COM_SEGUNDOS);
        String fim = data + "T" + horaFim.format(FORMATO_HORA_COM_SEGUNDOS);
        return Map.of(
                "id", eventId,
                "summary", summary,
                "start", Map.of("dateTime", inicio, "timeZone", fusoHorario),
                "end", Map.of("dateTime", fim, "timeZone", fusoHorario));
    }

    private void removerEvento(ContaGoogleCalendar conta, String accessToken, String eventId) {
        try {
            comRetentativa(() -> restClient
                    .delete()
                    .uri(URL_EVENTOS_BASE + "/{calendarioId}/events/{eventId}", conta.getCalendarioId(), eventId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .toBodilessEntity());
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
