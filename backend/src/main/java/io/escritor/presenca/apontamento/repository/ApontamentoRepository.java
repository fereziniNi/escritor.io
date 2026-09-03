package io.escritor.presenca.apontamento.repository;

import io.escritor.presenca.apontamento.domain.Apontamento;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApontamentoRepository extends JpaRepository<Apontamento, Long> {

    List<Apontamento> findByCardOrderByInicioDesc(Card card);

    /**
     * `FimIsNotNull` exclui qualquer registro legado sem `fim` (do "Iniciar timer", removido) -
     * equivalente a filtrar `minutos` não nulo (mesmo invariante de {@link Apontamento}), mas
     * espelha a linguagem do domínio em vez do campo derivado.
     */
    List<Apontamento> findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
            Usuario usuario, Instant inicioDoDia, Instant fimDoDia);

    /**
     * Sem `FimIsNotNull` de propósito, diferente da query acima (S4.8) - esta é uma listagem/
     * relatório (S4.10), não uma soma, então um eventual registro legado sem `fim` continua
     * aparecendo (mesma escolha já feita pra listagem por card, S4.7).
     */
    List<Apontamento> findByUsuarioAndInicioGreaterThanEqualAndInicioLessThanOrderByInicioDesc(
            Usuario usuario, Instant inicio, Instant fim);

    /**
     * Travessia `card.coluna.projeto` (S5.5) - agregação por projeto, diferente de S5.4 (por
     * card): soma todos os apontamentos fechados de todos os cards de todas as colunas do
     * projeto, não só de um usuário.
     */
    List<Apontamento> findByCard_Coluna_ProjetoAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
            Projeto projeto, Instant inicio, Instant fim);
}
