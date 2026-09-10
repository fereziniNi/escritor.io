package io.escritor.presenca.kanban.repository;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessaoTrabalhoRepository extends JpaRepository<SessaoTrabalho, Long> {

    /** A sessão aberta agora (cronômetro rodando), se houver - só pode existir uma por card. */
    Optional<SessaoTrabalho> findByCardAndFimIsNull(Card card);

    /** A sessão aberta agora do usuário, em qualquer card - pedido do usuário: "o cronômetro
     * deve estar... no canto superior direito", widget global que precisa saber qual é A tarefa
     * ativa dessa pessoa. {@link io.escritor.presenca.kanban.service.SessaoTrabalhoService#iniciar}
     * garante que só existe uma por usuário ao mesmo tempo. */
    Optional<SessaoTrabalho> findByUsuarioAndFimIsNull(Usuario usuario);

    List<SessaoTrabalho> findByCardOrderByInicioAsc(Card card);

    /** Mesma query que {@code ApontamentoRepository} tinha (S4.8) - só fechadas (`FimIsNotNull`)
     * entram na soma; uma sessão ainda aberta no período não tem duração calculável ainda. */
    List<SessaoTrabalho> findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
            Usuario usuario, Instant inicio, Instant fim);

    /** Travessia `card.coluna.projeto` (S5.5) - agregação por projeto, de qualquer pessoa que
     * trabalhou nos cards dele, não só de um usuário. */
    List<SessaoTrabalho> findByCard_Coluna_ProjetoAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
            Projeto projeto, Instant inicio, Instant fim);
}
