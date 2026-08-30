package io.escritor.presenca.escritorio.repository;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.TipoZona;
import io.escritor.presenca.escritorio.domain.Zona;
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
class ZonaRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private MapaRepository mapaRepository;

    @Autowired
    private ZonaRepository zonaRepository;

    @Test
    void persisteERecuperaZona() {
        Mapa mapa = mapaRepository.saveAndFlush(new Mapa("Sala de testes", 10, 8, "{}", false));

        Zona salva = zonaRepository.saveAndFlush(new Zona(mapa, "Sala de foco", 0, 0, 4, 4, TipoZona.FOCO));

        Zona recuperada = zonaRepository.findById(salva.getId()).orElseThrow();
        assertThat(recuperada.getMapa().getId()).isEqualTo(mapa.getId());
        assertThat(recuperada.getNome()).isEqualTo("Sala de foco");
        assertThat(recuperada.getTipo()).isEqualTo(TipoZona.FOCO);
    }

    @Test
    void zonasSeedadasPelaMigracaoV21PertencemAoMapaAtivo() {
        Mapa mapaAtivo = mapaRepository.findAll().stream().filter(Mapa::isAtivo).findFirst().orElseThrow();

        assertThat(zonaRepository.findAll())
                .hasSize(3)
                .allSatisfy(zona -> assertThat(zona.getMapa().getId()).isEqualTo(mapaAtivo.getId()));
    }
}
