package io.escritor.presenca.skills.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.seguranca.JwtService;
import io.escritor.presenca.seguranca.SecurityConfig;
import io.escritor.presenca.skills.domain.AcaoSkillNaoPermitidaException;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.ConflitoSkillException;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.SkillInvalidaException;
import io.escritor.presenca.skills.service.SkillConsultaService;
import io.escritor.presenca.skills.service.SkillFachada;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SkillController.class)
@Import({SecurityConfig.class, JwtService.class})
class SkillControllerTest {

    private static final String CORPO = """
            {"slug":"minha-skill","nome":"Minha skill","descricao":"d","categoria":"IA","promptUso":"p",
             "tutorialInstalacao":"t","mensagem":"primeira","arquivos":[{"caminho":"SKILL.md","conteudo":"x"}]}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SkillFachada fachada;

    @MockitoBean
    private SkillConsultaService consulta;

    @MockitoBean
    private ContextoUsuarioAutenticado contexto;

    private static SkillVersaoResponse versao() {
        return new SkillVersaoResponse(1, EstadoVersao.PUBLICADA, "Minha skill", "d", CategoriaSkill.IA, "p", "t",
                "primeira", 7L, "Ana", Instant.parse("2026-01-01T00:00:00Z"), null, null, null,
                List.of(new ArquivoResponse("SKILL.md", "x")));
    }

    @Test
    void listarSemAutenticacaoRetorna401() throws Exception {
        mockMvc.perform(get("/skills")).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void listarDevolveAsSkills() throws Exception {
        when(fachada.listar(null, null, null, false)).thenReturn(List.of(new SkillResumoResponse("minha-skill",
                "Minha skill", "d", CategoriaSkill.IA, true, false, 2, true, Instant.parse("2026-01-01T00:00:00Z"))));

        mockMvc.perform(get("/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("minha-skill"))
                .andExpect(jsonPath("$[0].propostaPendente").value(true));
    }

    @Test
    @WithMockUser
    void criarRetorna201() throws Exception {
        when(fachada.criar(any(), any())).thenReturn(versao());

        mockMvc.perform(post("/skills").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(1))
                .andExpect(jsonPath("$.estado").value("PUBLICADA"));
    }

    @Test
    @WithMockUser
    void salvarRetorna200() throws Exception {
        when(fachada.salvar(eq("minha-skill"), any(), any())).thenReturn(versao());

        mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autorNome").value("Ana"));
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void aprovarComoColaboradorRetorna403() throws Exception {
        mockMvc.perform(post("/skills/minha-skill/versoes/2/aprovar")).andExpect(status().isForbidden());
        verify(fachada, never()).aprovar(any(), anyInt(), any());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void aprovarComoGestorRetorna200() throws Exception {
        when(contexto.usuarioAtual()).thenReturn(new Usuario("Gil", "g@x.io", Papel.GESTOR, 480));
        when(fachada.aprovar(eq("minha-skill"), eq(2), any())).thenReturn(versao());

        mockMvc.perform(post("/skills/minha-skill/versoes/2/aprovar")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "COLABORADOR")
    void rejeitarOficialArquivadaEPropostasExigemGestor() throws Exception {
        mockMvc.perform(post("/skills/s-s/versoes/2/rejeitar").contentType(MediaType.APPLICATION_JSON)
                .content("{\"motivo\":\"x\"}")).andExpect(status().isForbidden());
        mockMvc.perform(put("/skills/s-s/oficial").contentType(MediaType.APPLICATION_JSON)
                .content("{\"valor\":true}")).andExpect(status().isForbidden());
        mockMvc.perform(put("/skills/s-s/arquivada").contentType(MediaType.APPLICATION_JSON)
                .content("{\"valor\":true}")).andExpect(status().isForbidden());
        mockMvc.perform(get("/skills/propostas")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void oficialEArquivadaChamamAFachada() throws Exception {
        mockMvc.perform(put("/skills/s-s/oficial").contentType(MediaType.APPLICATION_JSON)
                .content("{\"valor\":true}")).andExpect(status().isNoContent());
        verify(fachada).definirOficial(eq("s-s"), eq(true), any());
        mockMvc.perform(put("/skills/s-s/arquivada").contentType(MediaType.APPLICATION_JSON)
                .content("{\"valor\":false}")).andExpect(status().isNoContent());
        verify(fachada).definirArquivada(eq("s-s"), eq(false), any());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void propostasNaoECapturadaPorSlug() throws Exception {
        when(fachada.propostas(any())).thenReturn(List.of(new PropostaResponse("minha-skill", "Minha skill", 3, "Ana",
                Instant.parse("2026-01-01T00:00:00Z"), "msg")));

        mockMvc.perform(get("/skills/propostas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].numero").value(3));
        verify(fachada, never()).detalhe(any());
    }

    @Test
    @WithMockUser
    void oficiaisZipNaoECapturadoPorSlug() throws Exception {
        when(consulta.zipDasOficiais()).thenReturn(new byte[] {1, 2});

        mockMvc.perform(get("/skills/oficiais.zip"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/zip"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"skills-oficiais-multiplica.zip\""))
                .andExpect(content().bytes(new byte[] {1, 2}));
        verify(fachada, never()).detalhe(any());
    }

    @Test
    @WithMockUser
    void zipDaSkillTemHeaders() throws Exception {
        when(consulta.zipDaSkill("minha-skill", 2)).thenReturn(new byte[] {9});

        mockMvc.perform(get("/skills/minha-skill/zip").param("versao", "2"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/zip"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"minha-skill.zip\""));
    }

    @Test
    @WithMockUser
    void skillInvalidaVira400ComMensagem() throws Exception {
        when(fachada.criar(any(), any())).thenThrow(new SkillInvalidaException("Slug inválido"));

        mockMvc.perform(post("/skills").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value("Slug inválido"));
    }

    @Test
    @WithMockUser
    void conflitoVira409ComMensagem() throws Exception {
        when(fachada.salvar(any(), any(), any())).thenThrow(new ConflitoSkillException("Já existe proposta de Ana"));

        mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("Já existe proposta de Ana"));
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void flagSemOCampoValorRetorna400ESemChamarOServico() throws Exception {
        String msg = "Informe o campo \"valor\" (true ou false).";
        for (String rota : List.of("oficial", "arquivada")) {
            for (String corpo : List.of("{\"oficial\":true}", "{}", "{\"valor\":null}")) {
                mockMvc.perform(put("/skills/s-s/" + rota).contentType(MediaType.APPLICATION_JSON).content(corpo))
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.mensagem").value(msg));
            }
            mockMvc.perform(put("/skills/s-s/" + rota)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.mensagem").value(msg));
        }
        verify(fachada, never()).definirOficial(any(), anyBoolean(), any());
        verify(fachada, never()).definirArquivada(any(), anyBoolean(), any());
    }

    @Test
    @WithMockUser(roles = "GESTOR")
    void rejeitarSemMotivoOuSemCorpoRetorna400() throws Exception {
        for (String corpo : List.of("{}", "{\"motivo\":null}", "{\"motivo\":\"  \"}")) {
            mockMvc.perform(post("/skills/s-s/versoes/2/rejeitar").contentType(MediaType.APPLICATION_JSON)
                    .content(corpo)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.mensagem").exists());
        }
        mockMvc.perform(post("/skills/s-s/versoes/2/rejeitar")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").exists());
        verify(fachada, never()).rejeitar(any(), anyInt(), any(), any());
    }

    @Test
    @WithMockUser
    void nomeDoArquivoZipESanitizado() throws Exception {
        when(consulta.zipDaSkill("Ab_c\"x", null)).thenReturn(new byte[] {1});

        mockMvc.perform(get("/skills/{s}/zip", "Ab_c\"x"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"-b-c-x.zip\""));
    }

    @Test
    @WithMockUser
    void propostaPendenteConcorrenteNoBancoVira409() throws Exception {
        when(fachada.salvar(any(), any(), any())).thenThrow(new DataIntegrityViolationException("x",
                new RuntimeException("duplicate key value violates unique constraint \"uq_skill_versao_proposta_pendente\"")));

        mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("Já existe uma proposta pendente para esta skill."));
    }

    @Test
    @WithMockUser
    void numeroDeVersaoDuplicadoNoBancoVira409() throws Exception {
        when(fachada.salvar(any(), any(), any())).thenThrow(new DataIntegrityViolationException("x",
                new RuntimeException("duplicate key value violates unique constraint \"uk_skill_versao_numero\"")));

        mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("Outra alteração foi salva ao mesmo tempo. Tente de novo."));
    }

    @Test
    @WithMockUser
    void outraViolacaoDeIntegridadeNaoViraConflito() throws Exception {
        when(fachada.salvar(any(), any(), any())).thenThrow(new DataIntegrityViolationException("x",
                new RuntimeException("violates constraint \"outra_constraint\"")));

        org.junit.jupiter.api.Assertions.assertThrows(jakarta.servlet.ServletException.class,
                () -> mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON)
                        .content(CORPO)));
    }

    @Test
    @WithMockUser
    void acaoNaoPermitidaVira403() throws Exception {
        when(fachada.salvar(any(), any(), any())).thenThrow(new AcaoSkillNaoPermitidaException("não pode"));

        mockMvc.perform(post("/skills/minha-skill/versoes").contentType(MediaType.APPLICATION_JSON).content(CORPO))
                .andExpect(status().isForbidden());
    }
}
