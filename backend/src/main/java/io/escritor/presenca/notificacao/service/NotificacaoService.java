package io.escritor.presenca.notificacao.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.notificacao.domain.Notificacao;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.repository.NotificacaoRepository;
import io.escritor.presenca.notificacao.web.NotificacaoResponse;
import io.escritor.presenca.notificacao.web.NotificacoesResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Pedido do usuário: "Não achei a parte da notificação dentro do sistema... quero ver as últimas
 * que chegaram no sistema" - ver {@link Notificacao} pro porquê disso existir. {@link #registrar}
 * é chamado pelos serviços que já mandavam o toast/alerta em tempo real (`ReuniaoService`,
 * `CardService`, `HappyHourService`), sempre ao lado do `avisarX` que já existia - nunca em vez
 * dele.
 */
@Service
public class NotificacaoService {

    private final NotificacaoRepository notificacaoRepository;
    private final Clock clock;

    public NotificacaoService(NotificacaoRepository notificacaoRepository, Clock clock) {
        this.notificacaoRepository = notificacaoRepository;
        this.clock = clock;
    }

    public void registrar(Usuario destinatario, TipoNotificacao tipo, String texto, String link) {
        notificacaoRepository.save(new Notificacao(destinatario, tipo, texto, link, Instant.now(clock)));
    }

    public NotificacoesResponse listarMinhas(Usuario usuario) {
        List<NotificacaoResponse> itens = notificacaoRepository.findTop30ByDestinatarioOrderByCriadoEmDesc(usuario).stream()
                .map(NotificacaoResponse::de)
                .toList();
        long naoLidas = notificacaoRepository.countByDestinatarioAndLidaFalse(usuario);
        return new NotificacoesResponse(itens, naoLidas);
    }

    /** Mesma UX de inbox de sempre: abrir a central já marca tudo como lido, sem precisar de um
     * botão "marcar como lida" por item. Lote pequeno (mesma escala de time pequeno já assumida
     * no resto do projeto - poucas notificações não lidas por vez) - sem `@Modifying @Query` de
     * update em massa, só busca e salva de novo. */
    public void marcarTodasComoLidas(Usuario usuario) {
        List<Notificacao> naoLidas = notificacaoRepository.findByDestinatarioAndLidaFalse(usuario);
        naoLidas.forEach(Notificacao::marcarComoLida);
        notificacaoRepository.saveAll(naoLidas);
    }
}
