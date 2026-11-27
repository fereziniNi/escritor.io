package io.escritor.presenca.kanban.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Corrida na primeira tarefa pessoal: duas threads, um só projeto pessoal, nenhuma falha. */
@Testcontainers
@SpringBootTest
class ProjetoPessoalServiceIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private ProjetoPessoalService projetoPessoalService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void duasChamadasSimultaneasCriamUmSoProjetoPessoal() throws Exception {
        // sem transação de teste: o save do repositório já commita
        Usuario ana = usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-corrida-pessoal@escritor.io", Papel.COLABORADOR, 480));

        int threads = 2;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch largada = new CountDownLatch(1);
        try {
            Callable<Long> tarefa = () -> {
                largada.await();
                return projetoPessoalService.obterOuCriar(ana).getId();
            };
            Future<Long> a = pool.submit(tarefa);
            Future<Long> b = pool.submit(tarefa);
            largada.countDown();

            Long idA = a.get(30, TimeUnit.SECONDS);
            Long idB = b.get(30, TimeUnit.SECONDS);

            assertThat(idA).isNotNull().isEqualTo(idB);
            Integer total = jdbcTemplate.queryForObject(
                    "select count(*) from projeto where pessoal_de_usuario_id = ?", Integer.class, ana.getId());
            assertThat(total).isEqualTo(1);
            Integer colunas = jdbcTemplate.queryForObject(
                    "select count(*) from coluna where projeto_id = ?", Integer.class, idA);
            assertThat(colunas).isEqualTo(3);
        } finally {
            pool.shutdownNow();
        }
    }
}
