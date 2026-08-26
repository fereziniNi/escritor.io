package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
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
class CodigoAcessoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CodigoAcessoRepository codigoAcessoRepository;

    @Test
    void encontraOCodigoNaoUsadoMaisRecenteDoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));

        CodigoAcesso antigo = codigoAcessoRepository.saveAndFlush(new CodigoAcesso(usuario, "hash-antigo"));
        antigo.marcarUsado(antigo.getCriadoEm());
        codigoAcessoRepository.saveAndFlush(antigo);

        CodigoAcesso recente = codigoAcessoRepository.saveAndFlush(new CodigoAcesso(usuario, "hash-recente"));

        CodigoAcesso encontrado = codigoAcessoRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario)
                .orElseThrow();

        assertThat(encontrado.getId()).isEqualTo(recente.getId());
        assertThat(encontrado.getCodigoHash()).isEqualTo("hash-recente");
    }

    @Test
    void naoEncontraNadaQuandoTodosOsCodigosJaForamUsados() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Bruno Lima", "bruno@escritor.io", Papel.COLABORADOR, 360));

        CodigoAcesso codigo = codigoAcessoRepository.saveAndFlush(new CodigoAcesso(usuario, "hash"));
        codigo.marcarUsado(codigo.getCriadoEm());
        codigoAcessoRepository.saveAndFlush(codigo);

        assertThat(codigoAcessoRepository.findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario))
                .isEmpty();
    }
}
