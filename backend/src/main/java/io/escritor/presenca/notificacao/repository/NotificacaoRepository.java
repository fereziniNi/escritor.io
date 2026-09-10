package io.escritor.presenca.notificacao.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.notificacao.domain.Notificacao;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificacaoRepository extends JpaRepository<Notificacao, Long> {

    /** As últimas 30 do destinatário, mais recente primeiro - "ver as últimas que chegaram no
     * sistema" (pedido do usuário) não precisa de paginação de verdade nesta primeira versão. */
    List<Notificacao> findTop30ByDestinatarioOrderByCriadoEmDesc(Usuario destinatario);

    long countByDestinatarioAndLidaFalse(Usuario destinatario);

    List<Notificacao> findByDestinatarioAndLidaFalse(Usuario destinatario);
}
