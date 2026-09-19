package io.escritor.presenca.identidade.repository;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmailAndAtivoTrue(String email);

    List<Usuario> findByAtivoTrueOrderByNomeAsc();

    /** Pedido do usuário: avisar o admin por WhatsApp quando uma tarefa muda de status ou é
     * criada - `CardService`, não `EnvioWhatsApp#enviarParaChefe` (número fixo de configuração,
     * usado só pelo ponto) porque aqui o destinatário é quem tem o papel ADMIN de verdade no
     * sistema, podendo ser mais de uma pessoa. */
    List<Usuario> findByPapelAndAtivoTrueOrderByNomeAsc(Papel papel);
}
