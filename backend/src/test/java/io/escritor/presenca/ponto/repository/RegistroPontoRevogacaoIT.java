package io.escritor.presenca.ponto.repository;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Prova, via SQL bruto (sem passar pela aplicação), que o papel de runtime presenca_app
 * (ver db-init/criar-papel-app.sql e V8__create_registro_ponto.sql) realmente não consegue
 * alterar nem apagar uma marcação de ponto - a garantia central do PRD §3.2. Não usa
 * @SpringBootTest/@ServiceConnection de propósito: essa infraestrutura sempre conecta com o
 * papel administrador do container, que é dono das tabelas e por isso ignora qualquer REVOKE
 * contra si mesmo.
 */
@Testcontainers
class RegistroPontoRevogacaoIT {

    @Container
    static PostgreSQLContainer postgres =
            new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @BeforeAll
    static void migrar() {
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }

    @Test
    void papelDeRuntimeNaoConsegueAtualizarNemApagarRegistroPonto() throws Exception {
        try (Connection admin = conectarComo(postgres.getUsername(), postgres.getPassword())) {
            executar(
                    admin,
                    """
                    INSERT INTO usuario (nome, email, papel, carga_diaria_minutos)
                    VALUES ('Ana Souza', 'ana@escritor.io', 'COLABORADOR', 360)
                    """);
            executar(
                    admin,
                    """
                    INSERT INTO registro_ponto (usuario_id, tipo, momento, origem)
                    VALUES (1, 'ENTRADA', now(), 'WEB')
                    """);
        }

        try (Connection app = conectarComo("presenca_app", "presenca_app")) {
            assertThatThrownBy(() -> executar(app, "UPDATE registro_ponto SET tipo = 'SAIDA' WHERE id = 1"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("permission denied");

            assertThatThrownBy(() -> executar(app, "DELETE FROM registro_ponto WHERE id = 1"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("permission denied");

            // INSERT e SELECT continuam permitidos - só UPDATE/DELETE foram revogados.
            executar(
                    app,
                    """
                    INSERT INTO registro_ponto (usuario_id, tipo, momento, origem)
                    VALUES (1, 'PAUSA_INICIO', now(), 'WEB')
                    """);
        }
    }

    private Connection conectarComo(String usuario, String senha) throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), usuario, senha);
    }

    private void executar(Connection conexao, String sql) throws SQLException {
        try (Statement statement = conexao.createStatement()) {
            statement.execute(sql);
        }
    }
}
