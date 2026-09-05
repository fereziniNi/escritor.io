package io.escritor.presenca.googlecalendar.domain;

/** Sem {@code app.google.client-id}/{@code client-secret} configurados (env
 * {@code APP_GOOGLE_CLIENT_ID}/{@code APP_GOOGLE_CLIENT_SECRET}) - ver {@code GoogleOAuthService#habilitado}. */
public class GoogleIntegracaoDesabilitadaException extends RuntimeException {

    public GoogleIntegracaoDesabilitadaException() {
        super("Integração com Google Agenda não está configurada neste ambiente");
    }
}
