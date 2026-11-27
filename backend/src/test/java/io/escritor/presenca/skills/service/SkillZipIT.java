package io.escritor.presenca.skills.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import io.escritor.presenca.skills.repository.SkillRepository;
import io.escritor.presenca.skills.repository.SkillVersaoRepository;
import jakarta.persistence.EntityManager;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Garante que o zip é montado dentro da transação de leitura do serviço: os arquivos da versão são
 * lazy e, com open-in-view desligado, ler fora dela daria LazyInitializationException. O teste roda
 * sem transação própria e com o EntityManager limpo, como um controller chamaria.
 */
@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({SkillConsultaService.class, GeradorZipSkill.class})
class SkillZipIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private SkillConsultaService service;
    @Autowired
    private SkillRepository skillRepository;
    @Autowired
    private SkillVersaoRepository versaoRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private EntityManager em;

    private static Map<String, String> ler(byte[] zip) throws IOException {
        Map<String, String> r = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                r.put(e.getName(), new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return r;
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void zipsSaemForaDeTransacaoSemLazyInitializationException() throws IOException {
        Usuario autor = usuarioRepository.saveAndFlush(
                new Usuario("Ana Souza", "ana-zip@escritor.io", Papel.COLABORADOR, 480));
        Skill skill = skillRepository.saveAndFlush(new Skill("seguranca-zip", autor, Instant.now()));
        SkillVersao v1 = versaoRepository.saveAndFlush(new SkillVersao(skill, 1, EstadoVersao.PUBLICADA,
                "Segurança", "Descrição", CategoriaSkill.SEGURANCA, "Use", "Copie a pasta", "primeira", autor,
                Instant.now(), List.of(new ArquivoSkill("SKILL.md", "ação"),
                        new ArquivoSkill("referencia/headers.ts", "export {}"))));
        skill.definirVigente(v1);
        skill.marcarOficial(true);
        skillRepository.saveAndFlush(skill);
        em.clear();

        Map<String, String> unica = ler(service.zipDaSkill("seguranca-zip", null));
        assertThat(unica.keySet()).containsExactly("seguranca-zip/SKILL.md",
                "seguranca-zip/referencia/headers.ts", "seguranca-zip/TUTORIAL.md");
        assertThat(unica.get("seguranca-zip/SKILL.md")).isEqualTo("ação");

        em.clear();
        Map<String, String> porNumero = ler(service.zipDaSkill("seguranca-zip", 1));
        assertThat(porNumero).isEqualTo(unica);

        em.clear();
        Map<String, String> oficiais = ler(service.zipDasOficiais());
        assertThat(oficiais).containsEntry("seguranca-zip/SKILL.md", "ação")
                .containsEntry("seguranca-zip/TUTORIAL.md", "Copie a pasta");
    }
}
