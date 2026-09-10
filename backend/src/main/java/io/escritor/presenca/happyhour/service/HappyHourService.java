package io.escritor.presenca.happyhour.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.SorteioHappyHourWs;
import io.escritor.presenca.happyhour.domain.AtividadeHappyHour;
import io.escritor.presenca.happyhour.domain.NenhumaAtividadeParaSortearException;
import io.escritor.presenca.happyhour.repository.AtividadeHappyHourRepository;
import io.escritor.presenca.happyhour.web.AtividadeResponse;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: "ver as atividades para happy hour onde qualquer um pode adicionar uma nova
 * 'atividade'... uma parte para roleta onde será sorteado qual atividade será feita" - aberto a
 * qualquer usuário autenticado, mesma simplificação de sempre nesse app pra esse tipo de ação
 * (sem checar papel/dono). Sugerir é só REST simples (sem tempo real - mesmo espírito de
 * comentário de card); sortear é o "momento" compartilhado, por isso avisa todo mundo conectado
 * via {@link PresencaWebSocketHandler#avisarSorteioHappyHour}.
 */
@Service
public class HappyHourService {

    private final AtividadeHappyHourRepository atividadeHappyHourRepository;
    private final UsuarioRepository usuarioRepository;
    private final PresencaWebSocketHandler presencaWebSocketHandler;
    private final NotificacaoService notificacaoService;
    private final Clock clock;
    private final Random random;

    public HappyHourService(
            AtividadeHappyHourRepository atividadeHappyHourRepository,
            UsuarioRepository usuarioRepository,
            PresencaWebSocketHandler presencaWebSocketHandler,
            NotificacaoService notificacaoService,
            Clock clock,
            Random random) {
        this.atividadeHappyHourRepository = atividadeHappyHourRepository;
        this.usuarioRepository = usuarioRepository;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.notificacaoService = notificacaoService;
        this.clock = clock;
        this.random = random;
    }

    @Transactional(readOnly = true)
    public List<AtividadeResponse> listar() {
        return atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc().stream().map(AtividadeResponse::de).toList();
    }

    @Transactional
    public AtividadeResponse sugerir(String descricao, Usuario autor) {
        AtividadeHappyHour salva = atividadeHappyHourRepository.save(new AtividadeHappyHour(descricao, autor, Instant.now(clock)));
        return AtividadeResponse.de(salva);
    }

    /** Sorteia uma atividade entre TODAS as sugeridas (já sorteada antes ou não - "o que vai ser
     * feito" pode repetir num happy hour futuro) e avisa todo mundo conectado agora em tempo real
     * (não só quem girou). */
    @Transactional
    public AtividadeResponse sortear(Usuario autor) {
        List<AtividadeHappyHour> todas = atividadeHappyHourRepository.findAllByOrderByCriadaEmAsc();
        if (todas.isEmpty()) {
            throw new NenhumaAtividadeParaSortearException();
        }

        atividadeHappyHourRepository.findBySorteadaEmIsNotNull().ifPresent(AtividadeHappyHour::desmarcarSorteio);

        AtividadeHappyHour sorteada = todas.get(random.nextInt(todas.size()));
        sorteada.sortear(Instant.now(clock));
        AtividadeHappyHour salva = atividadeHappyHourRepository.save(sorteada);

        presencaWebSocketHandler.avisarSorteioHappyHour(
                new SorteioHappyHourWs(salva.getId(), salva.getDescricao(), autor.getNome()));
        // Mesmo escopo do broadcast acima (todo mundo, incluindo quem girou) - diferente dele, não
        // depende de estar conectado agora (pedido do usuário: "ver as últimas que chegaram no
        // sistema").
        String texto = "🎉 Roleta girou! Atividade escolhida: \"" + salva.getDescricao() + "\"";
        for (Usuario usuario : usuarioRepository.findByAtivoTrueOrderByNomeAsc()) {
            notificacaoService.registrar(usuario, TipoNotificacao.SORTEIO_HAPPY_HOUR, texto, null);
        }

        return AtividadeResponse.de(salva);
    }

    @Transactional(readOnly = true)
    public Optional<AtividadeResponse> sorteioAtual() {
        return atividadeHappyHourRepository.findBySorteadaEmIsNotNull().map(AtividadeResponse::de);
    }
}
