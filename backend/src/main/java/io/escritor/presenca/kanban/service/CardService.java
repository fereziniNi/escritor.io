package io.escritor.presenca.kanban.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.NovaTarefaWs;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.TarefaConcluidaWs;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
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
import io.escritor.presenca.ponto.notificacao.EnvioWhatsApp;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final ProjetoService projetoService;
    private final EnvioWhatsApp envioWhatsApp;

    public CardService(
            CardRepository cardRepository,
            ColunaRepository colunaRepository,
            UsuarioRepository usuarioRepository,
            ProjetoWebSocketHandler projetoWebSocketHandler,
            CardEventoRepository cardEventoRepository,
            PresencaWebSocketHandler presencaWebSocketHandler,
            NotificacaoService notificacaoService,
            ProjetoService projetoService,
            EnvioWhatsApp envioWhatsApp) {
        this.cardRepository = cardRepository;
        this.colunaRepository = colunaRepository;
        this.usuarioRepository = usuarioRepository;
        this.projetoWebSocketHandler = projetoWebSocketHandler;
        this.cardEventoRepository = cardEventoRepository;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.notificacaoService = notificacaoService;
        this.projetoService = projetoService;
        this.envioWhatsApp = envioWhatsApp;
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
        verificarAcesso(coluna.getProjeto(), criadoPor);
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
        // Pedido do usuário: "criou alguma atividade... deve informar ao admin pelo WhatsApp" -
        // além do aviso na tela acima (pra todo mundo), o admin também recebe por WhatsApp.
        avisarAdminsPorWhatsapp(textoNovaTarefa, criadoPor);

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

        // Auditoria de segurança (VULN-02, HIGH): antes disto, qualquer autenticado movia
        // qualquer card pra qualquer coluna - inclusive de/pra um projeto sem nenhum vínculo,
        // sem checagem nenhuma. Confirmado ao vivo: dava pra "sequestrar" um card confidencial de
        // um projeto invisível só sabendo o id numérico dele. Checa acesso ANTES de sequer
        // resolver a coluna de destino (não só depois) - quem não pode ver o projeto do card não
        // aprende nada sobre a coluna de destino também, nem que ela exista.
        Projeto projetoDoCard = card.getColuna().getProjeto();
        verificarAcesso(projetoDoCard, autor);

        Coluna novaColuna = colunaRepository
                .findById(novaColunaId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Coluna não encontrada: " + novaColunaId));

        // Mesmo um membro legítimo de dois projetos não pode "transferir" um card de um pro
        // outro - nenhuma fatia deste sistema jamais ofereceu isso como funcionalidade (o board
        // do frontend só arrasta dentro do próprio projeto aberto), então tratamos como erro
        // sempre, não como uma permissão a mais pra conceder.
        if (!Objects.equals(projetoDoCard.getId(), novaColuna.getProjeto().getId())) {
            throw new AcessoNegadoException("Não é possível mover um card para uma coluna de outro projeto");
        }

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
            // Pedido do usuário: "quando uma atividade muda de status, de feito para fazendo ou
            // [...] deve informar ao admin pelo WhatsApp" - qualquer mudança de coluna, em
            // qualquer direção (não só ao entrar na última coluna, diferente de
            // `avisarSeFinalizouATarefa` acima) - o admin acompanha o fluxo inteiro, não só a
            // conclusão.
            String textoMudancaDeStatus = autor.getNome() + " moveu \"" + salvo.getTitulo() + "\" de \"" + colunaAnterior.getNome()
                    + "\" para \"" + novaColuna.getNome() + "\" em " + novaColuna.getProjeto().getNome();
            avisarAdminsPorWhatsapp(textoMudancaDeStatus, autor);
        }

        projetoWebSocketHandler.broadcastCardMovido(novaColuna.getProjeto().getId(), response);

        return response;
    }

    /** Pedido do usuário: "não conseguimos editar... algumas atividades" - mesma checagem de
     * acesso de {@link #mover}, aberta a qualquer membro do projeto (sem restringir a quem criou
     * ou a um cargo, mesma simplificação já usada em criar/mover). Só grava evento de histórico
     * quando o responsável muda de verdade - finalmente aciona {@code MUDANCA_RESPONSAVEL}, que
     * já existia no vocabulário do domínio (S3.17) mas nunca tinha gerador nenhum. */
    public CardResponse atualizar(
            Long cardId, String titulo, String descricao, Long responsavelId, LocalDate prazo, Integer estimativaMinutos, Usuario autor) {
        Card card = cardRepository
                .findById(cardId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        verificarAcesso(card.getColuna().getProjeto(), autor);

        Usuario responsavelAnterior = card.getResponsavel();
        Usuario novoResponsavel = responsavelId == null ? null : buscarUsuario(responsavelId);

        card.editar(titulo, descricao, novoResponsavel, prazo, estimativaMinutos);
        Card salvo = cardRepository.save(card);

        if (!Objects.equals(idDe(responsavelAnterior), idDe(novoResponsavel))) {
            cardEventoRepository.save(new CardEvento(
                    salvo,
                    autor,
                    TipoEventoCard.MUDANCA_RESPONSAVEL,
                    responsavelAnterior == null ? null : responsavelAnterior.getNome(),
                    novoResponsavel == null ? null : novoResponsavel.getNome()));
        }

        CardResponse response = CardResponse.de(salvo);
        projetoWebSocketHandler.broadcastCardAtualizado(salvo.getColuna().getProjeto().getId(), response);
        return response;
    }

    /** Pedido do usuário (segunda pergunta - "apagar de verdade"): exclusão permanente, não
     * arquivamento - comentários/histórico/sessões de trabalho do card vão junto (cascata no
     * banco, ver migração V53), não ficam órfãos. Mesma checagem de acesso das outras ações. */
    public void excluir(Long cardId, Usuario autor) {
        Card card = cardRepository
                .findById(cardId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Card não encontrado: " + cardId));
        verificarAcesso(card.getColuna().getProjeto(), autor);

        Long projetoId = card.getColuna().getProjeto().getId();
        CardResponse response = CardResponse.de(card);
        cardRepository.delete(card);
        projetoWebSocketHandler.broadcastCardExcluido(projetoId, response);
    }

    private static Long idDe(Usuario usuario) {
        return usuario == null ? null : usuario.getId();
    }

    /** Pedido do usuário: "quando uma atividade muda de status... ou criou alguma atividade,
     * deve informar ao admin pelo WhatsApp" - todo usuário com papel ADMIN ativo, exceto quem fez
     * a própria ação (mesma regra de nunca notificar o autor sobre o que ele mesmo acabou de
     * fazer, já usada em {@link #avisarSeFinalizouATarefa}). Só quem cadastrou o próprio WhatsApp
     * recebe de verdade (ver {@code Usuario#getWhatsapp}, ADMIN-only) - pode ser mais de um
     * admin, ou nenhum com número cadastrado, os dois casos são válidos e não quebram nada. */
    private void avisarAdminsPorWhatsapp(String texto, Usuario autor) {
        for (Usuario admin : usuarioRepository.findByPapelAndAtivoTrueOrderByNomeAsc(Papel.ADMIN)) {
            if (admin.getId().equals(autor.getId())) {
                continue;
            }
            if (admin.getWhatsapp() != null && !admin.getWhatsapp().isBlank()) {
                envioWhatsApp.enviar(admin.getWhatsapp(), texto);
            }
        }
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
            // Pedido do usuário: avisar por WhatsApp quando uma tarefa é concluída, além do aviso
            // já existente na tela - só quem cadastrou o próprio WhatsApp (ver
            // Usuario#getWhatsapp, ADMIN-only); `EnvioWhatsApp#enviar` já ignora número em branco
            // sozinho, mas checar aqui evita montar/despachar uma chamada assíncrona à toa pra
            // quem nunca vai receber nada.
            if (destinatario.getWhatsapp() != null && !destinatario.getWhatsapp().isBlank()) {
                envioWhatsApp.enviar(destinatario.getWhatsapp(), textoConcluida);
            }
        }
    }

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + id));
    }

    /** Mesma regra/exceção de {@code CardComentarioService#verificarAcesso} (S3.15) - 403, não
     * 404, porque o recurso (card/coluna) já é referenciado direto por id na URL, então esconder
     * a existência não é o objetivo aqui, só bloquear a ação. */
    private void verificarAcesso(Projeto projeto, Usuario usuario) {
        if (!projetoService.usuarioPodeVer(projeto.getId(), usuario)) {
            throw new AcessoNegadoException("Usuário não tem acesso a este projeto");
        }
    }
}
