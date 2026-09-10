package io.escritor.presenca.chat.repository;

import io.escritor.presenca.chat.domain.Conversa;
import io.escritor.presenca.chat.domain.ConversaParticipante;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversaParticipanteRepository extends JpaRepository<ConversaParticipante, Long> {

    List<ConversaParticipante> findByUsuario(Usuario usuario);

    List<ConversaParticipante> findByConversa(Conversa conversa);

    Optional<ConversaParticipante> findByConversaAndUsuario(Conversa conversa, Usuario usuario);

    boolean existsByConversaAndUsuario(Conversa conversa, Usuario usuario);
}
