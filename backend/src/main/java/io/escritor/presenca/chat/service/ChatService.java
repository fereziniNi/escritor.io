package io.escritor.presenca.chat.service;

import io.escritor.presenca.chat.domain.AcessoNegadoAConversaException;
import io.escritor.presenca.chat.domain.Conversa;
import io.escritor.presenca.chat.domain.ConversaInvalidaException;
import io.escritor.presenca.chat.domain.ConversaParticipante;
import io.escritor.presenca.chat.domain.Mensagem;
import io.escritor.presenca.chat.domain.TipoConversa;
import io.escritor.presenca.chat.repository.ConversaParticipanteRepository;
import io.escritor.presenca.chat.repository.ConversaRepository;
import io.escritor.presenca.chat.repository.MensagemRepository;
import io.escritor.presenca.chat.web.ConversaResponse;
import io.escritor.presenca.chat.web.EnviarMensagemRequest;
import io.escritor.presenca.chat.web.MensagemResponse;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.ChatMensagemWs;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: "Implemente também um chat no sistema para os funcionários poderem
 * conversar e o chefe conversar com os funcionários, além de ter um grupo geral com todos os
 * funcionários... em tempo real... Não deve conter atraso." Persistência aqui via chamada REST
 * comum (como toda mutação do app); a entrega "em tempo real" é o {@link
 * PresencaWebSocketHandler#avisarMensagem} logo depois de salvar - mesmo padrão de {@code
 * ReuniaoService#criar} (HTTP pra persistir, WS só pra quem precisa saber agora).
 */
@Service
public class ChatService {

    private final ConversaRepository conversaRepository;
    private final ConversaParticipanteRepository participanteRepository;
    private final MensagemRepository mensagemRepository;
    private final UsuarioRepository usuarioRepository;
    private final PresencaWebSocketHandler presencaWebSocketHandler;
    private final Clock clock;

    public ChatService(
            ConversaRepository conversaRepository,
            ConversaParticipanteRepository participanteRepository,
            MensagemRepository mensagemRepository,
            UsuarioRepository usuarioRepository,
            PresencaWebSocketHandler presencaWebSocketHandler,
            Clock clock) {
        this.conversaRepository = conversaRepository;
        this.participanteRepository = participanteRepository;
        this.mensagemRepository = mensagemRepository;
        this.usuarioRepository = usuarioRepository;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.clock = clock;
    }

    /**
     * Get-or-create: a segunda vez que dois usuários quaisquer "conversam" devolve a mesma
     * conversa de antes, nunca duplica. Aberto a qualquer par (pedido do usuário: "funcionários
     * poderem conversar e o chefe conversar com os funcionários" - do ponto de vista do modelo é
     * a mesma ação, sem regra de papel).
     */
    @Transactional
    public ConversaResponse abrirConversaDireta(Usuario eu, Long outroUsuarioId) {
        if (outroUsuarioId.equals(eu.getId())) {
            throw new ConversaInvalidaException("Não é possível abrir uma conversa consigo mesmo");
        }
        Usuario outro = usuarioRepository
                .findById(outroUsuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + outroUsuarioId));

        Conversa conversa = buscarConversaDiretaExistente(eu, outro).orElseGet(() -> criarConversaDireta(eu, outro));
        return construirResposta(eu, conversa);
    }

    private Optional<Conversa> buscarConversaDiretaExistente(Usuario eu, Usuario outro) {
        return participanteRepository.findByUsuario(eu).stream()
                .map(ConversaParticipante::getConversa)
                .filter(conversa -> conversa.getTipo() == TipoConversa.DIRETA)
                .filter(conversa -> participanteRepository.existsByConversaAndUsuario(conversa, outro))
                .findFirst();
    }

    private Conversa criarConversaDireta(Usuario eu, Usuario outro) {
        Conversa conversa = conversaRepository.save(new Conversa(TipoConversa.DIRETA, Instant.now(clock)));
        participanteRepository.save(new ConversaParticipante(conversa, eu));
        participanteRepository.save(new ConversaParticipante(conversa, outro));
        return conversa;
    }

    /**
     * NÃO é {@code readOnly} (achado testando contra o Postgres de verdade, não pego pelos testes
     * com mock - mesma disciplina de {@code ReuniaoService#listarMinhas}, só que o bug é o
     * oposto): {@link #garantirParticipacaoNaGeral} pode inserir uma linha (self-heal, primeira
     * vez que a pessoa abre o chat), e como é uma chamada interna (via {@code this}), o AOP do
     * Spring não aplica o {@code @Transactional} PRÓPRIO dela - ela só herda a transação já aberta
     * aqui. Com {@code readOnly = true}, o Postgres rejeita esse INSERT com "cannot execute INSERT
     * in a read-only transaction" (não é só uma checagem do Hibernate, é a conexão JDBC de
     * verdade). {@link #construirResposta} continua seguro pra lazy loading de qualquer forma -
     * {@code @Transactional} comum já mantém a sessão aberta, `readOnly` era só uma otimização,
     * não a única forma de evitar {@code LazyInitializationException}.
     */
    @Transactional
    public List<ConversaResponse> listarMinhasConversas(Usuario eu) {
        garantirParticipacaoNaGeral(eu);
        return participanteRepository.findByUsuario(eu).stream()
                .map(ConversaParticipante::getConversa)
                .map(conversa -> construirResposta(eu, conversa))
                .sorted(Comparator.comparing(
                                (ConversaResponse resposta) -> resposta.ultimaMensagem() != null ? resposta.ultimaMensagem().criadoEm() : Instant.EPOCH)
                        .reversed())
                .toList();
    }

    /** Pedido do usuário: "grupo geral com todos os funcionários" - em vez de inserir uma linha
     * de participação pra cada usuário (na criação do usuário, ou via migração pra quem já
     * existe), cada um entra sozinho na própria conversa Geral na primeira vez que abre o chat.
     * Idempotente. */
    @Transactional
    public void garantirParticipacaoNaGeral(Usuario eu) {
        Conversa geral = conversaGeral();
        if (!participanteRepository.existsByConversaAndUsuario(geral, eu)) {
            participanteRepository.save(new ConversaParticipante(geral, eu));
        }
    }

    private Conversa conversaGeral() {
        return conversaRepository
                .findByTipo(TipoConversa.GERAL)
                .orElseThrow(() -> new IllegalStateException("Conversa geral não existe - ver V44__create_chat.sql"));
    }

    @Transactional
    public MensagemResponse enviar(Usuario autor, Long conversaId, EnviarMensagemRequest request) {
        Conversa conversa = buscarConversa(conversaId);
        ConversaParticipante minhaParticipacao = resolverParticipacao(autor, conversa);

        Mensagem mensagem = mensagemRepository.save(new Mensagem(conversa, autor, request.texto(), Instant.now(clock)));

        // quem manda já "leu" até agora - sem isso a própria mensagem contaria como não lida pra
        // quem a escreveu.
        minhaParticipacao.marcarLeituraEm(mensagem.getCriadoEm());
        participanteRepository.save(minhaParticipacao);

        MensagemResponse resposta = MensagemResponse.de(mensagem);
        participanteRepository.findByConversa(conversa).stream()
                .map(ConversaParticipante::getUsuario)
                .filter(usuario -> !usuario.getId().equals(autor.getId()))
                .forEach(usuario -> presencaWebSocketHandler.avisarMensagem(
                        usuario.getId(),
                        new ChatMensagemWs(
                                resposta.conversaId(), resposta.id(), resposta.autorId(), resposta.autorNome(), resposta.texto(),
                                resposta.criadoEm())));
        return resposta;
    }

    /** NÃO é {@code readOnly} - mesmo motivo de {@link #listarMinhasConversas}: {@link
     * #resolverParticipacao} pode inserir a participação self-heal na Geral, e é uma chamada
     * interna (sem passar pelo proxy do Spring). */
    @Transactional
    public List<MensagemResponse> listarMensagens(Usuario eu, Long conversaId) {
        Conversa conversa = buscarConversa(conversaId);
        resolverParticipacao(eu, conversa);
        return mensagemRepository.findTop100ByConversaOrderByCriadoEmDesc(conversa).stream()
                .sorted(Comparator.comparing(Mensagem::getCriadoEm))
                .map(MensagemResponse::de)
                .toList();
    }

    @Transactional
    public void marcarComoLida(Usuario eu, Long conversaId) {
        Conversa conversa = buscarConversa(conversaId);
        ConversaParticipante participacao = resolverParticipacao(eu, conversa);
        participacao.marcarLeituraEm(Instant.now(clock));
        participanteRepository.save(participacao);
    }

    private Conversa buscarConversa(Long conversaId) {
        return conversaRepository
                .findById(conversaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Conversa não encontrada: " + conversaId));
    }

    /** Participação já existente pra qualquer conversa; se for a Geral e ainda não existir, entra
     * sozinho agora (mesmo *self-heal* de {@link #garantirParticipacaoNaGeral} - cobre quem chega
     * direto num destes endpoints sem ter passado por {@code GET /chat/conversas} antes). Numa
     * DIRETA sem participação, é acesso negado - só os dois de quando ela foi criada. */
    private ConversaParticipante resolverParticipacao(Usuario usuario, Conversa conversa) {
        return participanteRepository.findByConversaAndUsuario(conversa, usuario).orElseGet(() -> {
            if (conversa.getTipo() == TipoConversa.GERAL) {
                return participanteRepository.save(new ConversaParticipante(conversa, usuario));
            }
            throw new AcessoNegadoAConversaException("Você não participa dessa conversa");
        });
    }

    private ConversaResponse construirResposta(Usuario eu, Conversa conversa) {
        String nome = nomeDaConversa(eu, conversa);
        MensagemResponse ultimaMensagem =
                mensagemRepository.findTopByConversaOrderByCriadoEmDesc(conversa).map(MensagemResponse::de).orElse(null);
        Instant lidoDesde = participanteRepository
                .findByConversaAndUsuario(conversa, eu)
                .map(ConversaParticipante::getUltimaLeituraEm)
                .orElse(null);
        long naoLidas = mensagemRepository.countByConversaAndCriadoEmAfter(conversa, lidoDesde != null ? lidoDesde : Instant.EPOCH);
        return new ConversaResponse(conversa.getId(), conversa.getTipo(), nome, ultimaMensagem, naoLidas);
    }

    private String nomeDaConversa(Usuario eu, Conversa conversa) {
        if (conversa.getTipo() == TipoConversa.GERAL) {
            return "Geral";
        }
        return participanteRepository.findByConversa(conversa).stream()
                .map(ConversaParticipante::getUsuario)
                .filter(usuario -> !usuario.getId().equals(eu.getId()))
                .map(Usuario::getNome)
                .findFirst()
                .orElse("Conversa");
    }
}
