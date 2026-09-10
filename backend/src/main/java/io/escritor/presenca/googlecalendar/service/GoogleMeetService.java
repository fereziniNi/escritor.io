package io.escritor.presenca.googlecalendar.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.reuniao.domain.Reuniao;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema vai conseguir marcar e entrar nas reuniões do meet pela nossa plataforma...
 * disponibilizar o link caso queira compartilhar". Diferente de {@code
 * GoogleCalendarSincronizacaoService} (janela rolante assíncrona de blocos de trabalho), este
 * serviço é síncrono e pontual: cria UM evento por vez, no calendário de quem organiza a reunião
 * (só o organizador consegue gerar o link, via {@code conferenceData.createRequest}), com os
 * demais participantes como {@code attendees} - a própria Google manda o convite por e-mail pra
 * eles (`sendUpdates=all`), sem precisar de nenhum envio de e-mail nosso, e sem exigir que eles
 * tenham conectado a própria conta.
 *
 * <p>Retentativa/token duplicam o que já existe em {@code GoogleCalendarSincronizacaoService} de
 * propósito (não extraído pra uma classe-base comum) - manter os dois desacoplados evita mexer
 * numa sincronização assíncrona já testada e em produção só por causa de um fluxo síncrono novo.
 */
@Service
public class GoogleMeetService {

    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String URL_EVENTOS_BASE = "https://www.googleapis.com/calendar/v3/calendars";
    private static final DateTimeFormatter FORMATO_HORA_COM_SEGUNDOS = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final int MAXIMO_TENTATIVAS = 4;
    private static final long ATRASO_BASE_RETENTATIVA_MS = 1000;

    private final ContaGoogleCalendarRepository contaRepository;
    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String fusoHorario;

    public GoogleMeetService(
            ContaGoogleCalendarRepository contaRepository,
            RestClient.Builder restClientBuilder,
            @Value("${app.google.client-id}") String clientId,
            @Value("${app.google.client-secret}") String clientSecret,
            @Value("${app.google.fuso-horario}") String fusoHorario) {
        this.contaRepository = contaRepository;
        this.restClient = restClientBuilder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.fusoHorario = fusoHorario;
    }

    /** Síncrono de propósito ({@code ReuniaoService} chama isso dentro da criação, não depois) -
     * pedido do usuário: "disponibilizar o link caso queira compartilhar", o link precisa estar na
     * resposta da própria criação da reunião, não chegar depois. Lança {@link
     * GoogleNaoConectadoException} se o criador nunca conectou (checado de novo aqui, defensivo -
     * {@code ReuniaoService} já checa antes de chegar a este ponto). */
    public String criarEventoComMeet(Usuario criador, Reuniao reuniao) {
        ContaGoogleCalendar conta = contaRepository.findByUsuario(criador).orElseThrow(GoogleNaoConectadoException::new);
        String accessToken = obterAccessToken(conta);
        Map<String, Object> corpo = corpoDoEvento(reuniao);

        RespostaEvento resposta = comRetentativaRetornando(() -> restClient
                .post()
                .uri(URL_EVENTOS_BASE + "/{calendarioId}/events?conferenceDataVersion=1&sendUpdates=all", conta.getCalendarioId())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(corpo)
                .retrieve()
                .body(RespostaEvento.class));
        if (resposta == null || resposta.hangoutLink() == null) {
            throw new IllegalStateException("Google não devolveu o link do Meet");
        }
        return resposta.hangoutLink();
    }

    /** Contraparte de {@link #criarEventoComMeet} pro cancelamento - melhor esforço (quem chama,
     * {@code ReuniaoService#remover}, engole falha: a reunião já foi cancelada do nosso lado
     * independente da Google responder ou não). */
    public void removerEvento(Usuario criador, Long reuniaoId) {
        contaRepository.findByUsuario(criador).ifPresent(conta -> {
            String accessToken = obterAccessToken(conta);
            try {
                comRetentativa(() -> restClient
                        .delete()
                        .uri(URL_EVENTOS_BASE + "/{calendarioId}/events/{eventId}", conta.getCalendarioId(), idDoEvento(reuniaoId))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .retrieve()
                        .toBodilessEntity());
            } catch (HttpClientErrorException.NotFound | HttpClientErrorException.Gone jaNaoExisteMais) {
                // evento já tinha sido removido (ou nunca chegou a existir) - nada a fazer
            }
        });
    }

    private static String idDoEvento(Long reuniaoId) {
        return "reu" + reuniaoId;
    }

    private Map<String, Object> corpoDoEvento(Reuniao reuniao) {
        String inicio = reuniao.getData() + "T" + reuniao.getHoraInicio().format(FORMATO_HORA_COM_SEGUNDOS);
        String fim = reuniao.getData() + "T" + reuniao.getHoraFim().format(FORMATO_HORA_COM_SEGUNDOS);
        List<Map<String, String>> participantes = reuniao.getParticipantes().stream()
                .map(participante -> Map.of("email", participante.getUsuario().getEmail()))
                .toList();
        return Map.of(
                "id", idDoEvento(reuniao.getId()),
                "summary", reuniao.getTitulo(),
                "start", Map.of("dateTime", inicio, "timeZone", fusoHorario),
                "end", Map.of("dateTime", fim, "timeZone", fusoHorario),
                "attendees", participantes,
                "conferenceData", Map.of(
                        "createRequest", Map.of(
                                "requestId", UUID.randomUUID().toString(),
                                "conferenceSolutionKey", Map.of("type", "hangoutsMeet"))));
    }

    /** Mesmo raciocínio de {@code GoogleCalendarSincronizacaoService#comRetentativa}: {@code 403
     * rateLimitExceeded}/{@code userRateLimitExceeded} são transientes (rajada, não cota nem
     * permissão) - a própria Google recomenda retentar com backoff em vez de desistir na primeira. */
    private static void comRetentativa(Runnable acao) {
        comRetentativaRetornando(() -> {
            acao.run();
            return null;
        });
    }

    private static <T> T comRetentativaRetornando(Supplier<T> acao) {
        for (int tentativa = 1; tentativa <= MAXIMO_TENTATIVAS; tentativa++) {
            try {
                return acao.get();
            } catch (HttpClientErrorException.Forbidden erro) {
                if (tentativa == MAXIMO_TENTATIVAS || !ehLimiteDeTaxa(erro)) {
                    throw erro;
                }
                dormir(ATRASO_BASE_RETENTATIVA_MS * (1L << (tentativa - 1)));
            }
        }
        throw new IllegalStateException("Inalcançável - o laço acima sempre retorna ou lança antes de terminar");
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
            throw new IllegalStateException("Chamada ao Google Meet interrompida", interrompido);
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

    private record RespostaEvento(@JsonProperty("hangoutLink") String hangoutLink) {
    }
}
