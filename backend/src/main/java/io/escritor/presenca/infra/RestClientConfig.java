package io.escritor.presenca.infra;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.web.client.RestClient;

/**
 * `RestClient.Builder` como bean explícito - a autoconfiguração padrão do Spring Boot pra isso
 * não estava disponível neste projeto (confirmado: sem este bean, {@code NotificacaoPontoWhatsApp}
 * falhava a subir com {@code NoSuchBeanDefinitionException} em todo teste `@SpringBootTest`).
 * Escopo prototype de propósito - cada injeção recebe um builder novo/independente pra customizar
 * (ex.: `baseUrl` próprio) sem interferir em outro consumidor futuro; é o mesmo escopo que a
 * autoconfiguração padrão do Spring Boot usaria.
 */
@Configuration
public class RestClientConfig {

    @Bean
    @Scope(BeanDefinition.SCOPE_PROTOTYPE)
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }
}
