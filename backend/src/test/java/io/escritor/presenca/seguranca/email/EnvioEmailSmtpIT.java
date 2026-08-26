package io.escritor.presenca.seguranca.email;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
class EnvioEmailSmtpIT {

    @Container
    static GenericContainer<?> mailpit =
            new GenericContainer<>(DockerImageName.parse("axllent/mailpit")).withExposedPorts(1025, 8025);

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void enviaEmailComOCodigoEChegaNoMailpit() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(mailpit.getHost());
        mailSender.setPort(mailpit.getMappedPort(1025));

        EnvioEmailSmtp envioEmail = new EnvioEmailSmtp(mailSender, "no-reply@escritor.io");

        envioEmail.enviarCodigoAcesso("destino@escritor.io", "123456");

        String baseUrl = "http://" + mailpit.getHost() + ":" + mailpit.getMappedPort(8025);

        Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            String mensagem = buscarCorpoDaUltimaMensagem(baseUrl);

            assertThat(mensagem).contains("destino@escritor.io");
            assertThat(mensagem).contains("123456");
        });
    }

    private String buscarCorpoDaUltimaMensagem(String baseUrl) throws Exception {
        JsonNode lista = get(baseUrl + "/api/v1/messages");
        String id = lista.get("messages").get(0).get("ID").asText();

        JsonNode mensagem = get(baseUrl + "/api/v1/message/" + id);
        return mensagem.toString();
    }

    private JsonNode get(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url)).GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return objectMapper.readTree(response.body());
    }
}
