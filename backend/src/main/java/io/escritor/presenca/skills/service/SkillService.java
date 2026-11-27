package io.escritor.presenca.skills.service;

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
import io.escritor.presenca.skills.domain.ValidadorPacoteSkill;
import io.escritor.presenca.skills.repository.SkillEventoRepository;
import io.escritor.presenca.skills.repository.SkillRepository;
import io.escritor.presenca.skills.repository.SkillVersaoRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: catálogo de skills da Multiplica em que qualquer pessoa cria e edita, mas as
 * "oficiais" só mudam com aprovação de GESTOR/ADMIN. Aqui ficam os comandos: criar, salvar (que
 * publica na hora ou vira proposta, conforme o selo), aprovar, rejeitar, restaurar uma versão
 * antiga, oficializar, arquivar e importar do repositório (autor nulo = "Sistema").
 */
@Service
@Transactional
public class SkillService {

    private static final Logger log = LoggerFactory.getLogger(SkillService.class);

    static final String MOTIVO_SELO_REMOVIDO = "Selo oficial removido";
    static final int MAX_NOME = 120;
    static final String MOTIVO_SUBSTITUIDA = "Substituída pelo autor";
    static final String MENSAGEM_IMPORTACAO_INICIAL = "Importada do repositório";
    static final String MENSAGEM_IMPORTACAO_ATUALIZACAO = "Atualização do repositório";

    /** Conteúdo de uma versão, como vem do editor (ou do importador). */
    public record DadosVersao(String nome, String descricao, CategoriaSkill categoria, String promptUso,
            String tutorialInstalacao, String mensagem, List<ArquivoSkill> arquivos) {
    }

    private final SkillRepository skillRepository;
    private final SkillVersaoRepository versaoRepository;
    private final SkillEventoRepository eventoRepository;
    private final UsuarioRepository usuarioRepository;
    private final NotificacaoService notificacaoService;
    private final Clock clock;

    public SkillService(SkillRepository skillRepository, SkillVersaoRepository versaoRepository,
            SkillEventoRepository eventoRepository, UsuarioRepository usuarioRepository,
            NotificacaoService notificacaoService, Clock clock) {
        this.skillRepository = skillRepository;
        this.versaoRepository = versaoRepository;
        this.eventoRepository = eventoRepository;
        this.usuarioRepository = usuarioRepository;
        this.notificacaoService = notificacaoService;
        this.clock = clock;
    }

    /** Cria a skill já com a versão 1 publicada e vigente; nasce não oficial. */
    public SkillVersao criar(String slug, DadosVersao dados, Usuario autor) {
        exigirAutor(autor);
        validar(slug, dados);
        if (skillRepository.existsBySlug(slug)) {
            throw new ConflitoSkillException("Já existe uma skill com o slug " + slug);
        }
        Skill skill = new Skill(slug, autor, agora());
        skillRepository.save(skill);
        return publicar(skill, dados, autor);
    }

    /** Skill comum publica na hora; skill oficial gera uma proposta que um gestor precisa aprovar. */
    public SkillVersao salvar(String slug, DadosVersao dados, Usuario autor) {
        exigirAutor(autor);
        validar(slug, dados);
        Skill skill = buscar(slug);
        return skill.isOficial() ? proporMudanca(skill, dados, autor) : publicar(skill, dados, autor);
    }

    /** Copia a versão {@code numero} como nova versão (mesma regra de {@link #salvar}). */
    public SkillVersao restaurar(String slug, int numero, Usuario autor) {
        exigirAutor(autor);
        Skill skill = buscar(slug);
        SkillVersao origem = buscarVersao(skill, numero);
        DadosVersao dados = new DadosVersao(origem.getNome(), origem.getDescricao(), origem.getCategoria(),
                origem.getPromptUso(), origem.getTutorialInstalacao(), "Restaurada da versão " + numero,
                origem.arquivosComoValor());
        validar(slug, dados);
        return skill.isOficial() ? proporMudanca(skill, dados, autor) : publicar(skill, dados, autor);
    }

    public SkillVersao aprovar(String slug, int numero, Usuario aprovador) {
        exigirGestor(aprovador, "aprovar propostas");
        Skill skill = buscar(slug);
        if (!skill.isOficial()) {
            throw new ConflitoSkillException("A skill não é mais oficial; não há proposta a aprovar");
        }
        SkillVersao versao = buscarPropostaPendente(skill, numero);
        versao.aprovar(aprovador, agora());
        skill.definirVigente(versao);
        notificarAutor(versao, aprovador, TipoNotificacao.SKILL_APROVADA,
                "Sua proposta na skill \"" + versao.getNome() + "\" foi aprovada");
        return versao;
    }

    public SkillVersao rejeitar(String slug, int numero, Usuario aprovador, String motivo) {
        exigirGestor(aprovador, "rejeitar propostas");
        if (motivo == null || motivo.isBlank()) {
            throw new SkillInvalidaException("Informe o motivo da rejeição");
        }
        Skill skill = buscar(slug);
        SkillVersao versao = buscarPropostaPendente(skill, numero);
        versao.rejeitar(aprovador, agora(), motivo.strip());
        notificarAutor(versao, aprovador, TipoNotificacao.SKILL_REJEITADA,
                "Sua proposta na skill \"" + versao.getNome() + "\" foi rejeitada: " + motivo.strip());
        return versao;
    }

    public void definirOficial(String slug, boolean oficial, Usuario por) {
        exigirGestor(por, "alterar o selo oficial");
        Skill skill = buscar(slug);
        if (skill.isOficial() == oficial) {
            return;
        }
        skill.marcarOficial(oficial);
        if (!oficial) {
            // sem selo não há aprovação: uma proposta pendente ficaria órfã
            versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA).ifPresent(pendente -> {
                pendente.rejeitar(por, agora(), MOTIVO_SELO_REMOVIDO);
                notificarAutor(pendente, por, TipoNotificacao.SKILL_REJEITADA,
                        "Sua proposta na skill \"" + pendente.getNome() + "\" foi rejeitada: "
                                + MOTIVO_SELO_REMOVIDO);
            });
        }
        eventoRepository.save(new SkillEvento(skill,
                oficial ? TipoEventoSkill.OFICIALIZADA : TipoEventoSkill.OFICIAL_REMOVIDO, por, agora(), null));
    }

    public void definirArquivada(String slug, boolean arquivada, Usuario por) {
        exigirGestor(por, "arquivar skills");
        Skill skill = buscar(slug);
        if (skill.isArquivada() == arquivada) {
            return;
        }
        skill.marcarArquivada(arquivada);
        eventoRepository.save(new SkillEvento(skill,
                arquivada ? TipoEventoSkill.ARQUIVADA : TipoEventoSkill.DESARQUIVADA, por, agora(), null));
    }

    /**
     * Importa uma skill oficial do repositório (autor nulo = "Sistema"). Skill nova nasce oficial e
     * publicada; hash igual ao já importado não faz nada; hash diferente vira proposta do Sistema,
     * substituindo apenas uma pendente também do Sistema (pendente de pessoa é respeitada e nada
     * muda, o hash não é registrado e a próxima importação tenta de novo). Quando nada é feito,
     * devolve a versão vigente. Skill que não é (mais) oficial também não é tocada.
     *
     * <p>Pedido do usuário ("aprove todas... faça isso por mim"): se a versão vigente também veio do
     * Sistema (ninguém editou a skill à mão), a atualização do repositório é publicada direto, sem
     * passar pela fila de aprovação, e uma proposta do Sistema que ficou pendente de uma subida
     * anterior é aprovada automaticamente. Skill com versão vigente de uma pessoa continua indo
     * para a fila, para a atualização não atropelar a edição dela sem um gestor olhar.
     */
    public SkillVersao importar(String slug, DadosVersao dados, String hash) {
        if (dados == null) {
            throw new SkillInvalidaException("Informe os dados da skill");
        }
        Skill existente = skillRepository.findComLockBySlug(slug).orElse(null);
        if (existente == null) {
            DadosVersao inicial = comMensagem(dados, MENSAGEM_IMPORTACAO_INICIAL);
            validar(slug, inicial);
            Skill skill = new Skill(slug, null, agora());
            skill.marcarOficial(true);
            skill.registrarHashImportado(hash);
            skillRepository.save(skill);
            return publicar(skill, inicial, null);
        }
        if (!existente.isOficial()) {
            log.warn("Skill oficial '{}' não importada: já existe uma skill não oficial com esse slug", slug);
            return existente.getVersaoVigente();
        }
        boolean vigenteDoSistema = existente.getVersaoVigente() == null
                || existente.getVersaoVigente().getAutor() == null;
        SkillVersao pendente = versaoRepository.findFirstBySkillAndEstado(existente, EstadoVersao.PROPOSTA)
                .orElse(null);
        if (Objects.equals(hash, existente.getHashImportado())) {
            if (vigenteDoSistema && pendente != null && pendente.getAutor() == null) {
                pendente.aprovar(null, agora());
                existente.definirVigente(pendente);
                log.info("Skill oficial '{}': proposta do Sistema v{} aprovada automaticamente", slug,
                        pendente.getNumero());
                return pendente;
            }
            return existente.getVersaoVigente();
        }
        DadosVersao atualizacao = comMensagem(dados, MENSAGEM_IMPORTACAO_ATUALIZACAO);
        validar(slug, atualizacao);
        if (pendente != null && pendente.getAutor() != null) {
            return existente.getVersaoVigente();
        }
        if (vigenteDoSistema) {
            if (pendente != null) {
                pendente.rejeitar(null, agora(), MOTIVO_SUBSTITUIDA);
                versaoRepository.saveAndFlush(pendente);
            }
            SkillVersao publicada = publicar(existente, atualizacao, null);
            existente.registrarHashImportado(hash);
            return publicada;
        }
        SkillVersao nova = proporMudanca(existente, atualizacao, null);
        existente.registrarHashImportado(hash);
        return nova;
    }

    // ---------- internos ----------

    private SkillVersao publicar(Skill skill, DadosVersao d, Usuario autor) {
        SkillVersao versao = novaVersao(skill, EstadoVersao.PUBLICADA, d, autor);
        versaoRepository.save(versao);
        skill.definirVigente(versao);
        return versao;
    }

    /** Cria a proposta pendente da skill oficial (regras: uma por skill; do mesmo autor substitui). */
    private SkillVersao proporMudanca(Skill skill, DadosVersao d, Usuario autor) {
        SkillVersao pendente = versaoRepository.findFirstBySkillAndEstado(skill, EstadoVersao.PROPOSTA)
                .orElse(null);
        if (pendente != null) {
            if (!mesmaOrigem(pendente.getAutor(), autor)) {
                String quem = pendente.getAutor() == null ? "Sistema" : pendente.getAutor().getNome();
                throw new ConflitoSkillException("Já existe uma proposta pendente de " + quem
                        + " nesta skill. Aguarde a decisão de um gestor antes de propor outra mudança");
            }
            pendente.rejeitar(null, agora(), MOTIVO_SUBSTITUIDA);
            // vai ao banco antes da nova proposta, senão o índice único de proposta pendente reclama
            versaoRepository.saveAndFlush(pendente);
        }
        SkillVersao proposta = novaVersao(skill, EstadoVersao.PROPOSTA, d, autor);
        versaoRepository.save(proposta);
        notificarGestores(proposta, autor);
        return proposta;
    }

    private SkillVersao novaVersao(Skill skill, EstadoVersao estado, DadosVersao d, Usuario autor) {
        return new SkillVersao(skill, versaoRepository.proximoNumero(skill), estado, d.nome().strip(),
                d.descricao(), d.categoria(), d.promptUso(), d.tutorialInstalacao(), d.mensagem(), autor, agora(),
                d.arquivos());
    }

    private void notificarGestores(SkillVersao proposta, Usuario autor) {
        String texto = (autor == null ? "Sistema" : autor.getNome()) + " propôs mudança na skill \""
                + proposta.getNome() + "\"";
        for (Papel papel : new Papel[] {Papel.GESTOR, Papel.ADMIN}) {
            for (Usuario destino : usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(papel)) {
                if (!mesmoAutor(destino, autor)) {
                    notificacaoService.registrar(destino, TipoNotificacao.SKILL_PROPOSTA, texto, null);
                }
            }
        }
    }

    /** Avisa o autor da proposta da decisão; Sistema (autor nulo) e o próprio decisor ficam de fora. */
    private void notificarAutor(SkillVersao versao, Usuario decisor, TipoNotificacao tipo, String texto) {
        Usuario autor = versao.getAutor();
        if (autor != null && !mesmoAutor(autor, decisor)) {
            notificacaoService.registrar(autor, tipo, texto, null);
        }
    }

    /** Como {@link #mesmoAutor}, mas dois autores nulos (Sistema) contam como a mesma origem. */
    private static boolean mesmaOrigem(Usuario a, Usuario b) {
        return (a == null && b == null) || mesmoAutor(a, b);
    }

    private static boolean mesmoAutor(Usuario a, Usuario b) {
        return a != null && b != null && Objects.equals(a.getId(), b.getId());
    }

    private Skill buscar(String slug) {
        return skillRepository.findComLockBySlug(slug)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Skill não encontrada: " + slug));
    }

    private SkillVersao buscarVersao(Skill skill, int numero) {
        return versaoRepository.findBySkillAndNumero(skill, numero).orElseThrow(
                () -> new RecursoNaoEncontradoException("Versão " + numero + " não encontrada na skill "
                        + skill.getSlug()));
    }

    private SkillVersao buscarPropostaPendente(Skill skill, int numero) {
        SkillVersao versao = buscarVersao(skill, numero);
        if (versao.getEstado() != EstadoVersao.PROPOSTA) {
            throw new ConflitoSkillException("A versão " + numero + " não está mais pendente de decisão");
        }
        return versao;
    }

    /** Checagem de gestor para consultas restritas (fila de propostas), além do {@code @PreAuthorize}. */
    public void exigirGestorParaPropostas(Usuario usuario) {
        exigirGestor(usuario, "ver a fila de propostas");
    }

    private static void exigirGestor(Usuario usuario, String acao) {
        if (usuario == null || (usuario.getPapel() != Papel.GESTOR && usuario.getPapel() != Papel.ADMIN)) {
            throw new AcaoSkillNaoPermitidaException("Só gestores e administradores podem " + acao);
        }
    }

    private static void exigirAutor(Usuario autor) {
        if (autor == null) {
            throw new AcaoSkillNaoPermitidaException("É preciso estar identificado para editar skills");
        }
    }

    private static DadosVersao comMensagem(DadosVersao d, String mensagem) {
        return new DadosVersao(d.nome(), d.descricao(), d.categoria(), d.promptUso(), d.tutorialInstalacao(),
                mensagem, d.arquivos());
    }

    private static void validar(String slug, DadosVersao d) {
        if (d == null) {
            throw new SkillInvalidaException("Informe os dados da skill");
        }
        ValidadorPacoteSkill.validarSlug(slug);
        if (d.nome() == null || d.nome().isBlank()) {
            throw new SkillInvalidaException("O nome da skill é obrigatório");
        }
        if (d.nome().strip().length() > MAX_NOME) {
            throw new SkillInvalidaException("O nome da skill pode ter no máximo " + MAX_NOME + " caracteres");
        }
        if (d.descricao() == null || d.descricao().isBlank()) {
            throw new SkillInvalidaException("A descrição da skill é obrigatória");
        }
        if (d.categoria() == null) {
            throw new SkillInvalidaException("A categoria da skill é obrigatória");
        }
        if (d.mensagem() == null || d.mensagem().isBlank()) {
            throw new SkillInvalidaException("Descreva o que mudou nesta versão");
        }
        if (d.promptUso() == null || d.tutorialInstalacao() == null) {
            throw new SkillInvalidaException("O prompt de uso e o tutorial de instalação não podem ser nulos");
        }
        if (d.arquivos() == null || d.arquivos().stream().anyMatch(Objects::isNull)) {
            throw new SkillInvalidaException("A lista de arquivos da skill é inválida");
        }
        ValidadorPacoteSkill.validarArquivos(slug, d.arquivos());
    }

    private Instant agora() {
        return Instant.now(clock);
    }
}
