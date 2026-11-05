package io.escritor.presenca.skills.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillArquivo;
import io.escritor.presenca.skills.domain.SkillVersao;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SkillRepositoryIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private SkillVersaoRepository versaoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private EntityManager em;

    private Usuario usuario() {
        return usuarioRepository.saveAndFlush(new Usuario("Ana Souza", "ana-skills@escritor.io", Papel.COLABORADOR, 480));
    }

    private SkillVersao versao(Skill skill, int numero, EstadoVersao estado, Usuario autor, List<ArquivoSkill> arquivos) {
        return new SkillVersao(skill, numero, estado, "Login por código", "Descrição", CategoriaSkill.SEGURANCA,
                "Use a skill", "Copie para .claude/skills", "primeira versão", autor, Instant.now(), arquivos);
    }

    @Test
    void persisteSkillComVersaoEArquivosERecuperaPorSlug() {
        Usuario autor = usuario();
        Skill skill = skillRepository.saveAndFlush(new Skill("login-codigo-email", autor, Instant.now()));
        SkillVersao v1 = versaoRepository.saveAndFlush(versao(skill, 1, EstadoVersao.PUBLICADA, autor,
                List.of(new ArquivoSkill("referencia/otp.ts", "export {}"), new ArquivoSkill("SKILL.md", "---\nname: x\n---"))));
        skill.definirVigente(v1);
        skillRepository.saveAndFlush(skill);
        em.clear();

        Skill lida = skillRepository.findBySlug("login-codigo-email").orElseThrow();

        assertThat(lida.getVersaoVigente().getNumero()).isEqualTo(1);
        assertThat(lida.getVersaoVigente().getArquivos()).extracting(SkillArquivo::getCaminho)
                .containsExactly("SKILL.md", "referencia/otp.ts");
        assertThat(lida.getVersaoVigente().arquivosComoValor()).extracting(ArquivoSkill::caminho)
                .containsExactly("SKILL.md", "referencia/otp.ts");
        assertThat(lida.isOficial()).isFalse();
        assertThat(lida.isArquivada()).isFalse();
    }

    @Test
    void slugDuplicadoViolaUnicidade() {
        Usuario autor = usuario();
        skillRepository.saveAndFlush(new Skill("duplicada", autor, Instant.now()));

        assertThatThrownBy(() -> skillRepository.saveAndFlush(new Skill("duplicada", autor, Instant.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void proximoNumeroComecaEm1EIncrementa() {
        Usuario autor = usuario();
        Skill skill = skillRepository.saveAndFlush(new Skill("numerada", autor, Instant.now()));
        assertThat(versaoRepository.proximoNumero(skill)).isEqualTo(1);

        versaoRepository.saveAndFlush(versao(skill, 1, EstadoVersao.PUBLICADA, autor, List.of(new ArquivoSkill("SKILL.md", "a"))));

        assertThat(versaoRepository.proximoNumero(skill)).isEqualTo(2);
    }

    @Test
    void buscaPrimeiraPropostaPendente() {
        Usuario autor = usuario();
        Skill skill = skillRepository.saveAndFlush(new Skill("com-proposta", autor, Instant.now()));
        versaoRepository.saveAndFlush(versao(skill, 1, EstadoVersao.PUBLICADA, autor, List.of(new ArquivoSkill("SKILL.md", "a"))));
        versaoRepository.saveAndFlush(versao(skill, 2, EstadoVersao.PROPOSTA, null, List.of(new ArquivoSkill("SKILL.md", "b"))));

        SkillVersao proposta = versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA).orElseThrow();

        assertThat(proposta.getNumero()).isEqualTo(2);
        assertThat(proposta.getAutor()).isNull();
        assertThat(versaoRepository.findByEstadoOrderByCriadaEmAsc(EstadoVersao.PROPOSTA)).hasSize(1);
        assertThat(versaoRepository.findBySkillAndNumero(skill, 1)).isPresent();
        assertThat(versaoRepository.findBySkillOrderByNumeroDesc(skill)).extracting(SkillVersao::getNumero).containsExactly(2, 1);
    }
}
