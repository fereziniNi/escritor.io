package io.escritor.presenca.skills.service;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import io.escritor.presenca.skills.repository.SkillRepository;
import io.escritor.presenca.skills.repository.SkillVersaoRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Pedido do usuário: catálogo de skills com busca, filtros e skills arquivadas fora da lista. */
@ExtendWith(MockitoExtension.class)
class SkillConsultaServiceTest {

    private static final Instant AGORA = Instant.parse("2026-01-15T12:00:00Z");

    @Mock
    private SkillRepository skillRepository;
    @Mock
    private SkillVersaoRepository versaoRepository;

    private SkillConsultaService service;
    private Skill seguranca;
    private Skill interfaceSkill;
    private Skill arquivada;

    private static Skill skill(String slug, String nome, String descricao, CategoriaSkill cat,
            boolean oficial, boolean arquivada) {
        Skill s = new Skill(slug, null, AGORA);
        s.definirVigente(new SkillVersao(s, 1, EstadoVersao.PUBLICADA, nome, descricao, cat, "p", "t", "m",
                null, AGORA, List.of(new ArquivoSkill("SKILL.md", "x"))));
        s.marcarOficial(oficial);
        s.marcarArquivada(arquivada);
        return s;
    }

    @BeforeEach
    void setUp() {
        service = new SkillConsultaService(skillRepository, versaoRepository, new GeradorZipSkill());
        seguranca = skill("seguranca", "Segurança", "Revisa headers", CategoriaSkill.SEGURANCA, true, false);
        interfaceSkill = skill("ui", "Interface", "Botões e telas", CategoriaSkill.INTERFACE, false, false);
        arquivada = skill("velha", "Velha", "Segurança antiga", CategoriaSkill.SEGURANCA, true, true);
        lenient().when(skillRepository.findAllByOrderBySlugAsc())
                .thenReturn(List.of(seguranca, interfaceSkill, arquivada));
    }

    @Test
    void listarOmiteArquivadasPorPadrao() {
        assertThat(service.listar(null, null, null, false)).containsExactly(seguranca, interfaceSkill);
        assertThat(service.listar(null, null, null, true)).containsExactly(seguranca, interfaceSkill, arquivada);
    }

    @Test
    void buscaIgnoraAcentoEMaiusculas() {
        assertThat(service.listar("SEGURANCA", null, null, false)).containsExactly(seguranca);
        assertThat(service.listar("botoes", null, null, false)).containsExactly(interfaceSkill);
    }

    @Test
    void filtraPorCategoriaESoOficiais() {
        assertThat(service.listar(null, CategoriaSkill.INTERFACE, null, false)).containsExactly(interfaceSkill);
        assertThat(service.listar(null, null, true, false)).containsExactly(seguranca);
        assertThat(service.listar(null, CategoriaSkill.INTERFACE, true, false)).isEmpty();
    }

    @Test
    void oficiaisParaZipExcluiArquivadasENaoOficiais() {
        assertThat(service.oficiaisNaoArquivadas()).containsExactly(seguranca);
    }

    @Test
    void buscarPorSlugEncontraSkillArquivada() {
        when(skillRepository.findBySlug("velha")).thenReturn(Optional.of(arquivada));
        assertThat(service.buscar("velha")).isSameAs(arquivada);
    }

    @Test
    void buscarSlugInexistenteLanca() {
        when(skillRepository.findBySlug("nada")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.buscar("nada")).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void propostaPendenteEVersoes() {
        SkillVersao proposta = new SkillVersao(seguranca, 2, EstadoVersao.PROPOSTA, "n", "d",
                CategoriaSkill.OUTRAS, "p", "t", "m", null, AGORA, List.of());
        when(versaoRepository.findFirstBySkillAndEstado(seguranca, EstadoVersao.PROPOSTA))
                .thenReturn(Optional.of(proposta));
        when(versaoRepository.findByEstadoOrderByCriadaEmAsc(EstadoVersao.PROPOSTA)).thenReturn(List.of(proposta));
        when(skillRepository.findBySlug("seguranca")).thenReturn(Optional.of(seguranca));
        when(versaoRepository.findBySkillOrderByNumeroDesc(seguranca)).thenReturn(List.of(proposta));
        when(versaoRepository.findBySkillAndNumero(seguranca, 2)).thenReturn(Optional.of(proposta));

        assertThat(service.propostaPendente(seguranca)).contains(proposta);
        assertThat(service.propostasPendentes()).containsExactly(proposta);
        assertThat(service.versoes("seguranca")).containsExactly(proposta);
        assertThat(service.versao("seguranca", 2)).isSameAs(proposta);
    }
}
