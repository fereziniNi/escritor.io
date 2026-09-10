package io.escritor.presenca.infra;

import java.util.Random;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Mesmo espírito de {@link ClockConfig} - injeta a fonte de aleatoriedade em vez de chamar
 * {@code new Random()}/{@code Math.random()} direto, pra dar pra fixar um seed nos testes de
 * serviço (ver {@code HappyHourService#sortear}). */
@Configuration
public class RandomConfig {

    @Bean
    Random random() {
        return new Random();
    }
}
