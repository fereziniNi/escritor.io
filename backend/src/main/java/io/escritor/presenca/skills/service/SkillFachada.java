package io.escritor.presenca.skills.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.skills.domain.ArquivoSkill;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.service.SkillService.DadosVersao;
import io.escritor.presenca.skills.web.ArquivoRequest;
import io.escritor.presenca.skills.web.CriarSkillRequest;
import io.escritor.presenca.skills.web.PropostaResponse;
import io.escritor.presenca.skills.web.SalvarVersaoRequest;
import io.escritor.presenca.skills.web.SkillDetalheResponse;
import io.escritor.presenca.skills.web.SkillResumoResponse;
import io.escritor.presenca.skills.web.SkillVersaoResponse;
import io.escritor.presenca.skills.web.VersaoResumoResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: API do catálogo de skills. Como {@code open-in-view} está desligado, o mapeamento
 * entidade para resposta (autor, arquivos lazy) precisa acontecer dentro de uma transação; esta
 * fachada chama os serviços de comando e consulta e devolve só os DTOs prontos para o controller.
 */
@Service
@Transactional
public class SkillFachada {

    private final SkillService skillService;
    private final SkillConsultaService consulta;

    public SkillFachada(SkillService skillService, SkillConsultaService consulta) {
        this.skillService = skillService;
        this.consulta = consulta;
    }

    @Transactional(readOnly = true)
    public List<SkillResumoResponse> listar(String busca, CategoriaSkill categoria, Boolean soOficiais,
            boolean incluirArquivadas) {
        return consulta.listar(busca, categoria, soOficiais, incluirArquivadas).stream()
                .map(s -> SkillResumoResponse.de(s, consulta.propostaPendente(s).isPresent()))
                .toList();
    }

    @Transactional(readOnly = true)
    public SkillDetalheResponse detalhe(String slug) {
        var skill = consulta.buscar(slug);
        return SkillDetalheResponse.de(skill, consulta.propostaPendente(skill).orElse(null));
    }

    @Transactional(readOnly = true)
    public List<VersaoResumoResponse> versoes(String slug) {
        return consulta.versoes(slug).stream().map(VersaoResumoResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public SkillVersaoResponse versao(String slug, int numero) {
        return SkillVersaoResponse.de(consulta.versao(slug, numero));
    }

    @Transactional(readOnly = true)
    public List<PropostaResponse> propostas(Usuario usuario) {
        skillService.exigirGestorParaPropostas(usuario);
        return consulta.propostasPendentes().stream().map(PropostaResponse::de).toList();
    }

    public SkillVersaoResponse criar(CriarSkillRequest r, Usuario autor) {
        var dados = dados(r.nome(), r.descricao(), r.categoria(), r.promptUso(), r.tutorialInstalacao(),
                r.mensagem(), r.arquivos());
        return SkillVersaoResponse.de(skillService.criar(r.slug(), dados, autor));
    }

    public SkillVersaoResponse salvar(String slug, SalvarVersaoRequest r, Usuario autor) {
        var dados = dados(r.nome(), r.descricao(), r.categoria(), r.promptUso(), r.tutorialInstalacao(),
                r.mensagem(), r.arquivos());
        return SkillVersaoResponse.de(skillService.salvar(slug, dados, autor));
    }

    public SkillVersaoResponse restaurar(String slug, int numero, Usuario autor) {
        return SkillVersaoResponse.de(skillService.restaurar(slug, numero, autor));
    }

    public SkillVersaoResponse aprovar(String slug, int numero, Usuario aprovador) {
        return SkillVersaoResponse.de(skillService.aprovar(slug, numero, aprovador));
    }

    public SkillVersaoResponse rejeitar(String slug, int numero, Usuario aprovador, String motivo) {
        return SkillVersaoResponse.de(skillService.rejeitar(slug, numero, aprovador, motivo));
    }

    public void definirOficial(String slug, boolean valor, Usuario por) {
        skillService.definirOficial(slug, valor, por);
    }

    public void definirArquivada(String slug, boolean valor, Usuario por) {
        skillService.definirArquivada(slug, valor, por);
    }

    private static DadosVersao dados(String nome, String descricao, CategoriaSkill categoria, String promptUso,
            String tutorial, String mensagem, List<ArquivoRequest> arquivos) {
        // lista nula ou com item nulo segue ao serviço, que responde 400 com mensagem
        List<ArquivoSkill> convertidos = arquivos == null ? null
                : arquivos.stream().map(a -> a == null ? null : new ArquivoSkill(a.caminho(), a.conteudo())).toList();
        return new DadosVersao(nome, descricao, categoria, promptUso, tutorial, mensagem, convertidos);
    }
}
