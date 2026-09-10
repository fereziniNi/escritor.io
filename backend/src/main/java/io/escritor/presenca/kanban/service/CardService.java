package io.escritor.presenca.kanban.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.NovaTarefaWs;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.TarefaConcluidaWs;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.CalculadoraPosicao;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.CardEvento;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.domain.TipoEventoCard;
import io.escritor.presenca.kanban.repository.CardEventoRepository;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.web.CardResponse;
import io.escritor.presenca.kanban.ws.ProjetoWebSocketHandler;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class CardService {

    private final CardRepository cardRepository;
    private final ColunaRepository colunaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ProjetoWebSocketHandler projetoWebSocketHandler;
    private final CardEventoRepository cardEventoRepository;
    private final PresencaWebSocketHandler presencaWebSocketHandler;
    private final NotificacaoService notificacaoService;

    public CardService(
            CardRepository cardRepository,
            ColunaRepository colunaRepository,
            UsuarioRepository usuarioRepository,
            ProjetoWebSocketHandler projetoWebSocketHandler,
            CardEventoRepository cardEventoRepository,
            PresencaWebSocketHandler presencaWebSocketHandler,
            NotificacaoService notificacaoService) {
        this.cardRepository = cardRepository;
        this.colunaRepository = colunaRepository;
        this.usuarioRepository = usuarioRepository;
        this.projetoWebSocketHandler = projetoWebSocketHandler;
        this.cardEventoRepository = cardEventoRepository;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.notificacaoService = notificacaoService;
    }

    public CardResponse criar(
            Long colunaId,
            String titulo,
            String descricao,
            Long responsavelId,
            LocalDate prazo,
            Integer estimativaMinutos,
            Usuario criadoPor) {
        Coluna coluna = colunaRepository
                .findById(colunaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Coluna não encontrada: " + colunaId));
        Usuario responsavel = responsavelId == null ? null : buscarUsuario(responsavelId);

        Double ultimaPosicao = cardRepository
                .findFirstByColunaOrderByPosicaoDesc(coluna)
                .map(Card::getPosicao)
                .orElse(null);
        double posicao = CalculadoraPosicao.entre(ultimaPosicao, null);

        Card novo = new Card(coluna, titulo, descricao, posicao, responsavel, prazo, estimativaMinutos, criadoPor);
        Card salvo = cardRepository.save(novo);

        // S3.17: o evento nasce aqui, dentro do mesmo serviço que cria o card - nunca é escrito
        // manualmente por outra camada (controller, evento assíncrono, etc.).
        cardEventoRepository.save(new CardEvento(salvo, criadoPor, TipoEventoCard.CRIACAO, null, coluna.getNome()));

        // Pedido do usuário: "quando qualquer pessoa adicionar uma tarefa nova... deve informar
        // todos os usuários do sistema... em qual projeto foi" - broadcast global (todo mundo
        // conectado agora, exceto quem criou), não uma lista de destinatários específicos como
        // `avisarSeFinalizouATarefa`.
        presencaWebSocketHandler.avisarNovaTarefa(
                criadoPor.getId(), new NovaTarefaWs(salvo.getId(), salvo.getTitulo(), coluna.getProjeto().getNome(), criadoPor.getNome()));
        // Mesmo escopo do broadcast acima ("todos os usuários do sistema") - diferente dele, não
        // depende de estar conectado agora: quem estiver offline ainda vê isto na central de
        // notificações depois (pedido do usuário: "ver as últimas que chegaram no sistema").
        String textoNovaTarefa = criadoPor.getNome() + " criou a tarefa \"" + salvo.getTitulo() + "\" em " + coluna.getProjeto().getNome();
        for (Usuario usuario : usuarioRepository.findByAtivoTrueOrderByNomeAsc()) {
            if (!usuario.getId().equals(criadoPor.getId())) {
                notificacaoService.registrar(usuario, TipoNotificacao.NOVA_TAREFA, textoNovaTarefa, null);
            }
        }

        return CardResponse.de(salvo);
    }

    /**
     * {@code indice} é a posição 0-based desejada na coluna de destino (a lista já sem o próprio
     * card, se ele já estava lá). Nunca toca nos outros cards da coluna - só recalcula a posição
     * do card movido a partir dos vizinhos no índice pedido.
     */
    public CardResponse mover(Long cardId, Long novaColunaId, int indice, Usuario autor) {
        Card card = cardRepository
                .findById(cardId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        Coluna novaColuna = colunaRepository
                .findById(novaColunaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Coluna não encontrada: " + novaColunaId));

        List<Card> cardsDoDestino = cardRepository.findByColunaOrderByPosicaoAsc(novaColuna).stream()
                .filter(outro -> !outro.getId().equals(card.getId()))
                .toList();

        // cardsDoDestino já exclui o próprio card - reordenar dentro da mesma coluna nunca conta
        // como "ocupando mais uma vaga", só entrar numa coluna diferente que já está no limite.
        Integer limiteWip = novaColuna.getLimiteWip();
        if (limiteWip != null && cardsDoDestino.size() >= limiteWip) {
            throw new LimiteWipExcedidoException(novaColuna.getId(), limiteWip);
        }

        Double anterior = indice <= 0 ? null : cardsDoDestino.get(indice - 1).getPosicao();
        Double proxima = indice >= cardsDoDestino.size() ? null : cardsDoDestino.get(indice).getPosicao();
        double novaPosicao = CalculadoraPosicao.entre(anterior, proxima);

        Coluna colunaAnterior = card.getColuna();
        card.mover(novaColuna, novaPosicao);
        Card salvo = cardRepository.save(card);
        CardResponse response = CardResponse.de(salvo);

        // S3.17: só é "mudança de coluna" de verdade quando a coluna muda - reordenar dentro da
        // mesma coluna não gera evento (não é uma transição no fluxo do card).
        if (!colunaAnterior.getId().equals(novaColuna.getId())) {
            cardEventoRepository.save(
                    new CardEvento(salvo, autor, TipoEventoCard.MUDANCA_COLUNA, colunaAnterior.getNome(), novaColuna.getNome()));
            avisarSeFinalizouATarefa(salvo, novaColuna, autor);
        }

        projetoWebSocketHandler.broadcastCardMovido(novaColuna.getProjeto().getId(), response);

        return response;
    }

    /**
     * Pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário" - o
     * board não tem uma coluna com significado fixo de "concluído" (nomes livres, só
     * `Coluna.ordem` pra ordenar), então a heurística é a convenção usual de Kanban: entrar na
     * ÚLTIMA coluna do projeto (maior `ordem`) conta como "terminou". Avisa o responsável e/ou
     * criador do card - nunca quem fez o próprio movimento (mover o próprio card não é novidade
     * pra quem moveu). Um board de coluna única não dispara nada (não existe "última coluna
     * diferente da atual" pra chegar).
     */
    private void avisarSeFinalizouATarefa(Card card, Coluna colunaDestino, Usuario autor) {
        List<Coluna> colunasDoProjeto = colunaRepository.findByProjetoOrderByOrdemAsc(colunaDestino.getProjeto());
        // defensivo - `colunaDestino` é uma coluna de verdade desse projeto, então essa lista
        // nunca deveria vir vazia; só não quebra se vier (dado inconsistente é motivo pra não
        // notificar, não pra derrubar o mover em si).
        if (colunasDoProjeto.isEmpty()) {
            return;
        }
        Coluna ultimaColuna = colunasDoProjeto.get(colunasDoProjeto.size() - 1);
        if (!ultimaColuna.getId().equals(colunaDestino.getId())) {
            return;
        }

        // Deduplica por id, não por igualdade de objeto - `Usuario` não sobrescreve
        // `equals`/`hashCode` (identidade padrão), então dois `Usuario` carregados
        // separadamente pro mesmo id não seriam iguais num `Set<Usuario>` comum.
        Map<Long, Usuario> destinatarios = new LinkedHashMap<>();
        if (card.getResponsavel() != null) {
            destinatarios.put(card.getResponsavel().getId(), card.getResponsavel());
        }
        destinatarios.put(card.getCriadoPor().getId(), card.getCriadoPor());
        destinatarios.remove(autor.getId());

        String textoConcluida = autor.getNome() + " concluiu \"" + card.getTitulo() + "\" em " + colunaDestino.getProjeto().getNome();
        for (Usuario destinatario : destinatarios.values()) {
            presencaWebSocketHandler.avisarTarefaConcluida(
                    destinatario.getId(),
                    new TarefaConcluidaWs(card.getId(), card.getTitulo(), colunaDestino.getProjeto().getNome(), autor.getNome()));
            notificacaoService.registrar(destinatario, TipoNotificacao.TAREFA_CONCLUIDA, textoConcluida, null);
        }
    }

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
    }
}
