package io.escritor.presenca.googlecalendar.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.escritor.presenca.googlecalendar.domain.ContaGoogleCalendar;
import io.escritor.presenca.googlecalendar.domain.EstadoOAuthGoogle;
import io.escritor.presenca.googlecalendar.domain.EstadoOAuthInvalidoException;
import io.escritor.presenca.googlecalendar.domain.GoogleIntegracaoDesabilitadaException;
import io.escritor.presenca.googlecalendar.repository.ContaGoogleCalendarRepository;
import io.escritor.presenca.googlecalendar.repository.EstadoOAuthGoogleRepository;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Pedido do usuário: "algo muito parecido com o agenda do google... ou ate mesmo integrar" - cada
 * funcionário conecta a própria conta Google (OAuth2), via mão única (publicamos a escala dele lá,
 * não lemos o Google Agenda de volta). Ninguém conecta em nome de outro, nem ADMIN.
 *
 * <p>Sem {@code app.google.client-id}/{@code client-secret} configurados, {@link #habilitado()}
 * retorna falso e todo o resto fica indisponível sem quebrar o resto do sistema - mesmo espírito
 * de {@code app.evolution.habilitado} em {@code EvolutionInstanceService}, só que aqui a
 * "desativação" vem da ausência de credencial, não de uma flag explícita (ninguém liga essa
 * integração sem ter as credenciais da Google em mãos primeiro).
 */
@Service
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);
    private static final Duration VALIDADE_ESTADO_OAUTH = Duration.ofMinutes(10);
    private static final String ESCOPO_CALENDAR = "https://www.googleapis.com/auth/calendar.events";
    private static final String URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String URL_TOKEN = "https://oauth2.googleapis.com/token";
    private static final String URL_REVOGAR = "https://oauth2.googleapis.com/revoke";

    private final ContaGoogleCalendarRepository contaRepository;
    private final EstadoOAuthGoogleRepository estadoRepository;
    private final RestClient restClient;
    private final String clientId;
    private final String clientSecret;
    private final String redirectUri;
    private final Clock clock;

    public GoogleOAuthService(
            ContaGoogleCalendarRepository contaRepository,
            EstadoOAuthGoogleRepository estadoRepository,
            RestClient.Builder restClientBuilder,
            @Value("${app.google.client-id}") String clientId,
            @Value("${app.google.client-secret}") String clientSecret,
            @Value("${app.google.redirect-uri}") String redirectUri,
            Clock clock) {
        this.contaRepository = contaRepository;
        this.estadoRepository = estadoRepository;
        this.restClient = restClientBuilder.build();
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.clock = clock;
    }

    public boolean habilitado() {
        return !clientId.isBlank() && !clientSecret.isBlank();
    }

    public boolean estaConectado(Usuario usuario) {
        return contaRepository.findByUsuario(usuario).isPresent();
    }

    /** Gera o nonce de uso único e devolve a URL de autorização pra onde o frontend deve
     * redirecionar a página inteira (não dá pra ser um fetch/XHR normal - a Google precisa de uma
     * navegação de verdade do navegador). */
    @Transactional
    public String iniciarConexao(Usuario usuario) {
        if (!habilitado()) {
            throw new GoogleIntegracaoDesabilitadaException();
        }
        String nonce = UUID.randomUUID().toString();
        Instant agora = Instant.now(clock);
        estadoRepository.save(new EstadoOAuthGoogle(nonce, usuario, agora.plus(VALIDADE_ESTADO_OAUTH), agora));

        return UriComponentsBuilder.fromUriString(URL_AUTORIZACAO)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", ESCOPO_CALENDAR)
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", nonce)
                .build()
                .toUriString();
    }

    /** Troca o código pelo token e salva/atualiza a conta - {@code state} tem que ser um nonce
     * vivo gerado por {@link #iniciarConexao}, de uso único (apagado aqui mesmo em caso de falha
     * depois, pra nunca ser reaproveitado). */
    @Transactional
    public void tratarCallback(String code, String state) {
        Instant agora = Instant.now(clock);
        EstadoOAuthGoogle estado = estadoRepository.findById(state).orElseThrow(EstadoOAuthInvalidoException::new);
        estadoRepository.delete(estado);
        if (estado.estaExpirado(agora)) {
            throw new EstadoOAuthInvalidoException();
        }

        RespostaToken resposta = trocarCodePorToken(code);
        Usuario usuario = estado.getUsuario();
        ContaGoogleCalendar conta = contaRepository
                .findByUsuario(usuario)
                .map(existente -> {
                    // a Google só reenvia refresh_token na primeira autorização (ou reconsentimento)
                    // - numa reconexão sem isso, mantém o token que já tínhamos.
                    if (resposta.refreshToken() != null) {
                        existente.atualizarRefreshToken(resposta.refreshToken());
                    }
                    return existente;
                })
                .orElseGet(() -> {
                    if (resposta.refreshToken() == null) {
                        throw new IllegalStateException("Google não devolveu refresh token numa primeira conexão");
                    }
                    return new ContaGoogleCalendar(usuario, resposta.refreshToken(), agora);
                });
        contaRepository.save(conta);
    }

    /** Revoga na Google (melhor esforço - se falhar, removemos a conta local do mesmo jeito, já
     * que o objetivo do usuário é parar de sincronizar, não necessariamente que a revogação na
     * Google tenha sucesso garantido). */
    @Transactional
    public void desconectar(Usuario usuario) {
        contaRepository
                .findByUsuario(usuario)
                .ifPresent(conta -> {
                    try {
                        restClient
                                .post()
                                .uri(URL_REVOGAR + "?token={token}", conta.getRefreshToken())
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .retrieve()
                                .toBodilessEntity();
                    } catch (RuntimeException erro) {
                        log.warn("Não foi possível revogar o token na Google (removendo a conta mesmo assim)", erro);
                    }
                    contaRepository.delete(conta);
                });
    }

    private RespostaToken trocarCodePorToken(String code) {
        MultiValueMap<String, String> corpo = new LinkedMultiValueMap<>();
        corpo.add("code", code);
        corpo.add("client_id", clientId);
        corpo.add("client_secret", clientSecret);
        corpo.add("redirect_uri", redirectUri);
        corpo.add("grant_type", "authorization_code");

        return restClient
                .post()
                .uri(URL_TOKEN)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(corpo)
                .retrieve()
                .body(RespostaToken.class);
    }

    private record RespostaToken(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("expires_in") Integer expiresIn) {
    }
}
