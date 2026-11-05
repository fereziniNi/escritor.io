package io.escritor.presenca.skills.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import io.escritor.presenca.skills.domain.AcaoSkillNaoPermitidaException;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.ConflitoSkillException;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillEvento;
import io.escritor.presenca.skills.domain.SkillInvalidaException;
import io.escritor.presenca.skills.domain.SkillVersao;
import io.escritor.presenca.skills.domain.TipoEventoSkill;
import io.escritor.presenca.skills.repository.SkillEventoRepository;
import io.escritor.presenca.skills.repository.SkillRepository;
import io.escritor.presenca.skills.repository.SkillVersaoRepository;
import io.escritor.presenca.skills.service.SkillService.DadosVersao;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** Pedido do usuário: catálogo de skills com versões, propostas e aprovação de GESTOR/ADMIN. */
@ExtendWith(MockitoExtension.class)
class SkillServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T12:00:00Z");
    private static final String SLUG = "seguranca";
    private static final String SKILL_MD = "---\nname: seguranca\ndescription: Boas praticas\n---\n# Corpo\n";

    @Mock
    private SkillRepository skillRepository;
    @Mock
    private SkillVersaoRepository versaoRepository;
    @Mock
    private SkillEventoRepository eventoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private NotificacaoService notificacaoService;

    private SkillService service;
    private Usuario ana;
    private Usuario bruno;
    private Usuario gestor;
    private Usuario admin;

    @BeforeEach
    void setUp() {
        service = new SkillService(skillRepository, versaoRepository, eventoRepository, usuarioRepository,
                notificacaoService, Clock.fixed(AGORA, ZoneOffset.UTC));
        ana = usuario("Ana Souza", Papel.COLABORADOR, 1L);
        bruno = usuario("Bruno Lima", Papel.COLABORADOR, 2L);
        gestor = usuario("Gabi Gestora", Papel.GESTOR, 3L);
        admin = usuario("Adam Admin", Papel.ADMIN, 4L);
        lenient().when(versaoRepository.proximoNumero(any())).thenReturn(2);
    }

    private static Usuario usuario(String nome, Papel papel, long id) {
        Usuario u = new Usuario(nome, nome.split(" ")[0].toLowerCase() + "@escritor.io", papel, 480);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static DadosVersao dados() {
        return new DadosVersao("Segurança", "Boas práticas", CategoriaSkill.SEGURANCA, "Use a skill seguranca",
                "Copie a pasta", "Ajuste inicial", List.of(new ArquivoSkill("SKILL.md", SKILL_MD)));
    }

    private Skill skillComVigente(boolean oficial) {
        Skill skill = new Skill(SLUG, ana, AGORA);
        skill.marcarOficial(oficial);
        SkillVersao v1 = new SkillVersao(skill, 1, EstadoVersao.PUBLICADA, "Segurança", "d", CategoriaSkill.SEGURANCA,
                "p", "t", "Primeira", ana, AGORA, List.of(new ArquivoSkill("SKILL.md", SKILL_MD)));
        skill.definirVigente(v1);
        lenient().when(skillRepository.findBySlug(SLUG)).thenReturn(Optional.of(skill));
        return skill;
    }

    private SkillVersao proposta(Skill skill, Usuario autor, int numero) {
        SkillVersao p = new SkillVersao(skill, numero, EstadoVersao.PROPOSTA, "Segurança 2", "d2",
                CategoriaSkill.SEGURANCA, "p", "t", "Mudança", autor, AGORA,
                List.of(new ArquivoSkill("SKILL.md", SKILL_MD)));
        lenient().when(versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA))
                .thenReturn(Optional.of(p));
        lenient().when(versaoRepository.findBySkillAndNumero(skill, numero)).thenReturn(Optional.of(p));
        return p;
    }

    private SkillVersao versaoSalva() {
        ArgumentCaptor<SkillVersao> c = ArgumentCaptor.forClass(SkillVersao.class);
        verify(versaoRepository).save(c.capture());
        return c.getValue();
    }

    private void gestoresAtivos() {
        lenient().when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.GESTOR))
                .thenReturn(List.of(gestor));
        lenient().when(usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN))
                .thenReturn(List.of(admin));
    }

    // ---------- criar ----------

    @Test
    void criarSkillNovaPublicaVersao1ComoVigenteENaoOficial() {
        when(skillRepository.existsBySlug(SLUG)).thenReturn(false);
        when(versaoRepository.proximoNumero(any())).thenReturn(1);

        SkillVersao v = service.criar(SLUG, dados(), ana);

        assertThat(v.getNumero()).isEqualTo(1);
        assertThat(v.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        assertThat(v.getAutor()).isSameAs(ana);
        assertThat(v.getSkill().getVersaoVigente()).isSameAs(v);
        assertThat(v.getSkill().isOficial()).isFalse();
        assertThat(v.getSkill().getCriadaPor()).isSameAs(ana);
    }

    @Test
    void criarComSlugExistenteLancaConflito() {
        when(skillRepository.existsBySlug(SLUG)).thenReturn(true);

        assertThatThrownBy(() -> service.criar(SLUG, dados(), ana)).isInstanceOf(ConflitoSkillException.class)
                .hasMessageContaining(SLUG);
        verify(skillRepository, never()).save(any());
    }

    @Test
    void criarValidaDadosSemNullPointer() {
        List<ArquivoSkill> ok = List.of(new ArquivoSkill("SKILL.md", SKILL_MD));
        DadosVersao[] ruins = {
            new DadosVersao("N", "d", CategoriaSkill.IA, "p", "t", " ", ok),
            new DadosVersao(" ", "d", CategoriaSkill.IA, "p", "t", "m", ok),
            new DadosVersao(null, "d", CategoriaSkill.IA, "p", "t", "m", ok),
            new DadosVersao("x".repeat(121), "d", CategoriaSkill.IA, "p", "t", "m", ok),
            new DadosVersao("N", " ", CategoriaSkill.IA, "p", "t", "m", ok),
            new DadosVersao("N", "d", null, "p", "t", "m", ok),
            new DadosVersao("N", "d", CategoriaSkill.IA, null, "t", "m", ok),
            new DadosVersao("N", "d", CategoriaSkill.IA, "p", null, "m", ok),
            new DadosVersao("N", "d", CategoriaSkill.IA, "p", "t", "m", null),
            new DadosVersao("N", "d", CategoriaSkill.IA, "p", "t", "m",
                    Arrays.asList(new ArquivoSkill("SKILL.md", SKILL_MD), null)),
        };
        for (DadosVersao d : ruins) {
            assertThatThrownBy(() -> service.criar(SLUG, d, ana)).isInstanceOf(SkillInvalidaException.class);
        }
        assertThatThrownBy(() -> service.criar(SLUG, null, ana)).isInstanceOf(SkillInvalidaException.class);
        verify(skillRepository, never()).save(any());
    }

    // ---------- salvar ----------

    @Test
    void salvarEmSkillNaoOficialPublicaNaHora() {
        Skill skill = skillComVigente(false);

        SkillVersao v = service.salvar(SLUG, dados(), bruno);

        assertThat(v.getNumero()).isEqualTo(2);
        assertThat(v.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        assertThat(skill.getVersaoVigente()).isSameAs(v);
        assertThat(versaoSalva()).isSameAs(v);
    }

    @Test
    void salvarEmSkillOficialCriaPropostaSemTrocarVigenteENotificaGestores() {
        Skill skill = skillComVigente(true);
        SkillVersao antiga = skill.getVersaoVigente();
        gestoresAtivos();
        when(versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA)).thenReturn(Optional.empty());

        SkillVersao v = service.salvar(SLUG, dados(), ana);

        assertThat(v.getEstado()).isEqualTo(EstadoVersao.PROPOSTA);
        assertThat(skill.getVersaoVigente()).isSameAs(antiga);
        String texto = "Ana Souza propôs mudança na skill \"Segurança\"";
        verify(notificacaoService).registrar(gestor, TipoNotificacao.SKILL_PROPOSTA, texto, null);
        verify(notificacaoService).registrar(admin, TipoNotificacao.SKILL_PROPOSTA, texto, null);
    }

    @Test
    void propostaDeGestorNaoNotificaOProprioGestor() {
        Skill skill = skillComVigente(true);
        gestoresAtivos();
        when(versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA)).thenReturn(Optional.empty());

        service.salvar(SLUG, dados(), gestor);

        verify(notificacaoService, never()).registrar(eq(gestor), any(), any(), any());
        verify(notificacaoService).registrar(eq(admin), eq(TipoNotificacao.SKILL_PROPOSTA), any(), isNull());
    }

    @Test
    void segundaPropostaDeOutraPessoaLancaConflitoCitandoAutor() {
        Skill skill = skillComVigente(true);
        proposta(skill, ana, 2);

        assertThatThrownBy(() -> service.salvar(SLUG, dados(), bruno)).isInstanceOf(ConflitoSkillException.class)
                .hasMessageContaining("Ana Souza");
        verify(versaoRepository, never()).save(any());
    }

    @Test
    void novaPropostaDoMesmoAutorSubstituiAAnterior() {
        Skill skill = skillComVigente(true);
        SkillVersao anterior = proposta(skill, ana, 2);
        gestoresAtivos();
        when(versaoRepository.proximoNumero(skill)).thenReturn(3);

        SkillVersao nova = service.salvar(SLUG, dados(), ana);

        assertThat(anterior.getEstado()).isEqualTo(EstadoVersao.REJEITADA);
        assertThat(anterior.getMotivoRejeicao()).isEqualTo("Substituída pelo autor");
        assertThat(nova.getNumero()).isEqualTo(3);
        assertThat(nova.getEstado()).isEqualTo(EstadoVersao.PROPOSTA);
        // a rejeição precisa ir ao banco antes da nova proposta (índice único de proposta pendente)
        var ordem = inOrder(versaoRepository);
        ordem.verify(versaoRepository).saveAndFlush(anterior);
        ordem.verify(versaoRepository).save(nova);
    }

    @Test
    void salvarValidaPacote() {
        skillComVigente(false);
        DadosVersao ruim = new DadosVersao("N", "d", CategoriaSkill.IA, "p", "t", "m",
                List.of(new ArquivoSkill("SKILL.md", SKILL_MD), new ArquivoSkill("../x", "y")));

        assertThatThrownBy(() -> service.salvar(SLUG, ruim, ana)).isInstanceOf(SkillInvalidaException.class);
        verify(versaoRepository, never()).save(any());
    }

    @Test
    void salvarSkillInexistenteLancaNaoEncontrado() {
        when(skillRepository.findBySlug(SLUG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.salvar(SLUG, dados(), ana))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    // ---------- aprovar / rejeitar ----------

    @Test
    void aprovarPropostaViraPublicadaEVigenteENotificaAutor() {
        Skill skill = skillComVigente(true);
        SkillVersao p = proposta(skill, ana, 2);

        SkillVersao r = service.aprovar(SLUG, 2, gestor);

        assertThat(r.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        assertThat(r.getDecididaPor()).isSameAs(gestor);
        assertThat(r.getDecididaEm()).isEqualTo(AGORA);
        assertThat(skill.getVersaoVigente()).isSameAs(p);
        verify(notificacaoService).registrar(ana, TipoNotificacao.SKILL_APROVADA,
                "Sua proposta na skill \"Segurança 2\" foi aprovada", null);
    }

    @Test
    void gestorPodeAprovarAPropriaProposta() {
        Skill skill = skillComVigente(true);
        proposta(skill, gestor, 2);

        SkillVersao r = service.aprovar(SLUG, 2, gestor);

        assertThat(r.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        verify(notificacaoService, never()).registrar(any(), any(), any(), any());
    }

    @Test
    void aprovarPropostaDoSistemaNaoNotifica() {
        Skill skill = skillComVigente(true);
        proposta(skill, null, 2);

        service.aprovar(SLUG, 2, admin);

        verify(notificacaoService, never()).registrar(any(), any(), any(), any());
    }

    @Test
    void colaboradorNaoPodeAprovarRejeitarOficializarArquivar() {
        assertThatThrownBy(() -> service.aprovar(SLUG, 2, ana)).isInstanceOf(AcaoSkillNaoPermitidaException.class);
        assertThatThrownBy(() -> service.rejeitar(SLUG, 2, ana, "x"))
                .isInstanceOf(AcaoSkillNaoPermitidaException.class);
        assertThatThrownBy(() -> service.definirOficial(SLUG, true, ana))
                .isInstanceOf(AcaoSkillNaoPermitidaException.class);
        assertThatThrownBy(() -> service.definirArquivada(SLUG, true, ana))
                .isInstanceOf(AcaoSkillNaoPermitidaException.class);
    }

    @Test
    void rejeitarExigeMotivo() {
        for (String motivo : new String[] {null, "", "  "}) {
            assertThatThrownBy(() -> service.rejeitar(SLUG, 2, gestor, motivo))
                    .isInstanceOf(SkillInvalidaException.class);
        }
    }

    @Test
    void rejeitarMarcaRejeitadaENotificaAutor() {
        Skill skill = skillComVigente(true);
        SkillVersao antiga = skill.getVersaoVigente();
        SkillVersao p = proposta(skill, ana, 2);

        SkillVersao r = service.rejeitar(SLUG, 2, gestor, "Falta exemplo");

        assertThat(r).isSameAs(p);
        assertThat(r.getEstado()).isEqualTo(EstadoVersao.REJEITADA);
        assertThat(r.getMotivoRejeicao()).isEqualTo("Falta exemplo");
        assertThat(skill.getVersaoVigente()).isSameAs(antiga);
        verify(notificacaoService).registrar(ana, TipoNotificacao.SKILL_REJEITADA,
                "Sua proposta na skill \"Segurança 2\" foi rejeitada: Falta exemplo", null);
    }

    @Test
    void aprovarVersaoQueNaoEPropostaLancaConflito() {
        Skill skill = skillComVigente(true);
        SkillVersao v1 = skill.getVersaoVigente();
        when(versaoRepository.findBySkillAndNumero(skill, 1)).thenReturn(Optional.of(v1));

        assertThatThrownBy(() -> service.aprovar(SLUG, 1, gestor)).isInstanceOf(ConflitoSkillException.class);
        assertThatThrownBy(() -> service.rejeitar(SLUG, 1, gestor, "x")).isInstanceOf(ConflitoSkillException.class);
        assertThat(v1.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
    }

    // ---------- restaurar ----------

    @Test
    void restaurarVersaoAntigaEmSkillOficialViraProposta() {
        Skill skill = skillComVigente(true);
        SkillVersao v1 = skill.getVersaoVigente();
        when(versaoRepository.findBySkillAndNumero(skill, 1)).thenReturn(Optional.of(v1));
        when(versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA)).thenReturn(Optional.empty());
        gestoresAtivos();

        SkillVersao nova = service.restaurar(SLUG, 1, ana);

        assertThat(nova.getEstado()).isEqualTo(EstadoVersao.PROPOSTA);
        assertThat(nova.getMensagem()).isEqualTo("Restaurada da versão 1");
        assertThat(nova.getNome()).isEqualTo(v1.getNome());
        assertThat(nova.arquivosComoValor()).isEqualTo(v1.arquivosComoValor());
        assertThat(skill.getVersaoVigente()).isSameAs(v1);
    }

    @Test
    void restaurarEmSkillNaoOficialPublicaNaHora() {
        Skill skill = skillComVigente(false);
        SkillVersao v1 = skill.getVersaoVigente();
        when(versaoRepository.findBySkillAndNumero(skill, 1)).thenReturn(Optional.of(v1));

        SkillVersao nova = service.restaurar(SLUG, 1, ana);

        assertThat(nova.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        assertThat(skill.getVersaoVigente()).isSameAs(nova);
    }

    // ---------- oficial / arquivada ----------

    @Test
    void definirOficialRegistraEvento() {
        Skill skill = skillComVigente(false);

        service.definirOficial(SLUG, true, gestor);
        assertThat(skill.isOficial()).isTrue();
        service.definirOficial(SLUG, false, gestor);
        assertThat(skill.isOficial()).isFalse();

        ArgumentCaptor<SkillEvento> c = ArgumentCaptor.forClass(SkillEvento.class);
        verify(eventoRepository, times(2)).save(c.capture());
        assertThat(c.getAllValues()).extracting(SkillEvento::getTipo)
                .containsExactly(TipoEventoSkill.OFICIALIZADA, TipoEventoSkill.OFICIAL_REMOVIDO);
        assertThat(c.getAllValues().get(0).getUsuario()).isSameAs(gestor);
        assertThat(c.getAllValues().get(0).getOcorridoEm()).isEqualTo(AGORA);
    }

    @Test
    void definirArquivadaRegistraEvento() {
        Skill skill = skillComVigente(false);

        service.definirArquivada(SLUG, true, admin);
        assertThat(skill.isArquivada()).isTrue();
        service.definirArquivada(SLUG, false, admin);
        assertThat(skill.isArquivada()).isFalse();

        ArgumentCaptor<SkillEvento> c = ArgumentCaptor.forClass(SkillEvento.class);
        verify(eventoRepository, times(2)).save(c.capture());
        assertThat(c.getAllValues()).extracting(SkillEvento::getTipo)
                .containsExactly(TipoEventoSkill.ARQUIVADA, TipoEventoSkill.DESARQUIVADA);
    }

    @Test
    void definirOficialSemMudancaNaoRegistraEvento() {
        skillComVigente(true);

        service.definirOficial(SLUG, true, gestor);

        verify(eventoRepository, never()).save(any());
    }

    // ---------- importar ----------

    @Test
    void importarCriaOficialComAutorNuloEHash() {
        when(skillRepository.findBySlug(SLUG)).thenReturn(Optional.empty());
        when(versaoRepository.proximoNumero(any())).thenReturn(1);

        SkillVersao v = service.importar(SLUG, dados(), "h1");

        Skill skill = v.getSkill();
        assertThat(skill.isOficial()).isTrue();
        assertThat(skill.getHashImportado()).isEqualTo("h1");
        assertThat(skill.getCriadaPor()).isNull();
        assertThat(v.getAutor()).isNull();
        assertThat(v.getEstado()).isEqualTo(EstadoVersao.PUBLICADA);
        assertThat(skill.getVersaoVigente()).isSameAs(v);
    }

    @Test
    void importarComHashIgualNaoFazNada() {
        Skill skill = skillComVigente(true);
        skill.registrarHashImportado("h1");

        service.importar(SLUG, dados(), "h1");

        verify(versaoRepository, never()).save(any());
        verify(notificacaoService, never()).registrar(any(), any(), any(), any());
    }

    @Test
    void importarComHashDiferenteCriaPropostaDeSistema() {
        Skill skill = skillComVigente(true);
        skill.registrarHashImportado("h1");
        gestoresAtivos();
        when(versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA)).thenReturn(Optional.empty());

        SkillVersao v = service.importar(SLUG, dados(), "h2");

        assertThat(v.getEstado()).isEqualTo(EstadoVersao.PROPOSTA);
        assertThat(v.getAutor()).isNull();
        assertThat(v.getMensagem()).isEqualTo("Atualização do repositório");
        assertThat(skill.getHashImportado()).isEqualTo("h2");
        verify(notificacaoService).registrar(gestor, TipoNotificacao.SKILL_PROPOSTA,
                "Sistema propôs mudança na skill \"Segurança\"", null);
    }

    @Test
    void importarSubstituiPendenteDoSistema() {
        Skill skill = skillComVigente(true);
        skill.registrarHashImportado("h1");
        SkillVersao pendente = proposta(skill, null, 2);
        gestoresAtivos();
        when(versaoRepository.proximoNumero(skill)).thenReturn(3);

        SkillVersao v = service.importar(SLUG, dados(), "h2");

        assertThat(pendente.getEstado()).isEqualTo(EstadoVersao.REJEITADA);
        assertThat(v.getNumero()).isEqualTo(3);
        verify(versaoRepository).saveAndFlush(pendente);
    }

    @Test
    void importarComPendenteDeHumanoNaoFazNada() {
        Skill skill = skillComVigente(true);
        skill.registrarHashImportado("h1");
        SkillVersao pendente = proposta(skill, ana, 2);

        service.importar(SLUG, dados(), "h2");

        assertThat(pendente.getEstado()).isEqualTo(EstadoVersao.PROPOSTA);
        assertThat(skill.getHashImportado()).isEqualTo("h1");
        verify(versaoRepository, never()).save(any());
    }
}
