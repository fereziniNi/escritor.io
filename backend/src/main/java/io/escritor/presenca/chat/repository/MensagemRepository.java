package io.escritor.presenca.chat.repository;

import io.escritor.presenca.chat.domain.Conversa;
import io.escritor.presenca.chat.domain.Mensagem;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MensagemRepository extends JpaRepository<Mensagem, Long> {

    /** Mais recentes primeiro, limitado a 100 - histórico completo/paginação infinita fica de
     * fora por agora (não pedido, volume esperado é baixo). {@code ChatService} reordena pra
     * cronológica ascendente antes de devolver pro front. */
    List<Mensagem> findTop100ByConversaOrderByCriadoEmDesc(Conversa conversa);

    /** Prévia da última mensagem pra listagem de conversas. */
    Optional<Mensagem> findTopByConversaOrderByCriadoEmDesc(Conversa conversa);

    long countByConversaAndCriadoEmAfter(Conversa conversa, Instant instante);
}
