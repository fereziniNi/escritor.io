package io.escritor.presenca.escritorio.repository;

import io.escritor.presenca.escritorio.domain.Mapa;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class MapaRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private MapaRepository mapaRepository;

    @Test
    void persisteERecuperaMapa() {
        Mapa salvo = mapaRepository.saveAndFlush(new Mapa("Sala de testes", 10, 8, "{\"paredes\": []}", false));

        Mapa recuperado = mapaRepository.findById(salvo.getId()).orElseThrow();
        assertThat(recuperado.getNome()).isEqualTo("Sala de testes");
        assertThat(recuperado.getLarguraTiles()).isEqualTo(10);
        assertThat(recuperado.getAlturaTiles()).isEqualTo(8);
        assertThat(recuperado.getLayoutJson()).isEqualTo("{\"paredes\": []}");
        assertThat(recuperado.isAtivo()).isFalse();
    }

    @Test
    void mapaSeedadoPelaMigracaoV20EstaAtivo() {
        assertThat(mapaRepository.findAll())
                .anySatisfy(mapa -> {
                    assertThat(mapa.getNome()).isEqualTo("Escritório");
                    assertThat(mapa.isAtivo()).isTrue();
                });
    }
}
