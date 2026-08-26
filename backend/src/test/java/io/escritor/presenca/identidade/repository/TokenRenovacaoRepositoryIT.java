package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.TokenRenovacao;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
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
class TokenRenovacaoRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16");

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private TokenRenovacaoRepository tokenRenovacaoRepository;

    @Test
    void encontraTokenPeloHash() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));
        tokenRenovacaoRepository.saveAndFlush(new TokenRenovacao(usuario, "hash-abc"));

        TokenRenovacao encontrado = tokenRenovacaoRepository.findByTokenHash("hash-abc").orElseThrow();

        assertThat(encontrado.getUsuario().getId()).isEqualTo(usuario.getId());
    }

    @Test
    void naoEncontraHashInexistente() {
        assertThat(tokenRenovacaoRepository.findByTokenHash("nao-existe")).isEmpty();
    }

    @Test
    void listaSomenteTokensNaoUsadosDoUsuario() {
        Usuario usuario = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360));

        TokenRenovacao usado = tokenRenovacaoRepository.saveAndFlush(new TokenRenovacao(usuario, "hash-usado"));
        usado.marcarUsado(usado.getCriadoEm());
        tokenRenovacaoRepository.saveAndFlush(usado);

        TokenRenovacao ativo = tokenRenovacaoRepository.saveAndFlush(new TokenRenovacao(usuario, "hash-ativo"));

        List<TokenRenovacao> ativos = tokenRenovacaoRepository.findByUsuarioAndUsadoEmIsNull(usuario);

        assertThat(ativos).extracting(TokenRenovacao::getId).containsExactly(ativo.getId());
    }
}
