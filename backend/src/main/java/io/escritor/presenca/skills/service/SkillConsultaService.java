package io.escritor.presenca.skills.service;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.domain.EstadoVersao;
import io.escritor.presenca.skills.domain.Skill;
import io.escritor.presenca.skills.domain.SkillVersao;
import io.escritor.presenca.skills.repository.SkillRepository;
import io.escritor.presenca.skills.repository.SkillVersaoRepository;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: catálogo de skills com busca e filtros. A busca ignora acento e maiúsculas
 * (nome e descrição da versão vigente); skills arquivadas ficam fora da lista padrão, mas abrem
 * pelo slug. A escala é pequena, então o filtro é feito em memória.
 */
@Service
@Transactional(readOnly = true)
public class SkillConsultaService {

    private final SkillRepository skillRepository;
    private final SkillVersaoRepository versaoRepository;
    private final GeradorZipSkill geradorZip;

    public SkillConsultaService(SkillRepository skillRepository, SkillVersaoRepository versaoRepository,
            GeradorZipSkill geradorZip) {
        this.geradorZip = geradorZip;
        this.skillRepository = skillRepository;
        this.versaoRepository = versaoRepository;
    }

    public List<Skill> listar(String busca, CategoriaSkill categoria, Boolean soOficiais,
            boolean incluirArquivadas) {
        String termo = busca == null || busca.isBlank() ? null : normalizar(busca.strip());
        return skillRepository.findAllByOrderBySlugAsc().stream()
                .filter(s -> incluirArquivadas || !s.isArquivada())
                .filter(s -> !Boolean.TRUE.equals(soOficiais) || s.isOficial())
                .filter(s -> categoria == null || categoria == s.getVersaoVigente().getCategoria())
                .filter(s -> termo == null || contem(s.getVersaoVigente(), termo))
                .toList();
    }

    /** Skills oficiais não arquivadas, para o {@code oficiais.zip}. */
    public List<Skill> oficiaisNaoArquivadas() {
        return listar(null, null, true, false);
    }

    public Skill buscar(String slug) {
        return skillRepository.findBySlug(slug)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Skill não encontrada: " + slug));
    }

    public List<SkillVersao> versoes(String slug) {
        return versaoRepository.findBySkillOrderByNumeroDesc(buscar(slug));
    }

    public SkillVersao versao(String slug, int numero) {
        return versaoRepository.findBySkillAndNumero(buscar(slug), numero).orElseThrow(
                () -> new RecursoNaoEncontradoException("Versão " + numero + " não encontrada na skill " + slug));
    }

    /**
     * Zip de uma skill montado dentro da transação de leitura (os arquivos são lazy). {@code numero}
     * nulo = versão vigente.
     */
    public byte[] zipDaSkill(String slug, Integer numero) {
        Skill skill = buscar(slug);
        SkillVersao versao = numero == null ? skill.getVersaoVigente() : versao(slug, numero);
        return geradorZip.gerar(slug, versao.arquivosComoValor(), versao.getTutorialInstalacao());
    }

    /** {@code oficiais.zip}: vigente de cada oficial não arquivada, montado na transação de leitura. */
    public byte[] zipDasOficiais() {
        return geradorZip.gerarVarias(oficiaisNaoArquivadas().stream()
                .map(s -> new GeradorZipSkill.PacoteZip(s.getSlug(),
                        s.getVersaoVigente().arquivosComoValor(), s.getVersaoVigente().getTutorialInstalacao()))
                .toList());
    }

    public Optional<SkillVersao> propostaPendente(Skill skill) {
        return versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA);
    }

    public List<SkillVersao> propostasPendentes() {
        return versaoRepository.findByEstadoOrderByCriadaEmAsc(EstadoVersao.PROPOSTA);
    }

    private static boolean contem(SkillVersao vigente, String termo) {
        return normalizar(vigente.getNome()).contains(termo) || normalizar(vigente.getDescricao()).contains(termo);
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }
}
