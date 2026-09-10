package io.escritor.presenca.ponto.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistroPontoRepository extends JpaRepository<RegistroPonto, Long> {

    Optional<RegistroPonto> findFirstByUsuarioOrderByCriadoEmDesc(Usuario usuario);

    List<RegistroPonto> findByUsuarioAndMomentoGreaterThanEqualOrderByMomentoAsc(Usuario usuario, Instant desde);

    /**
     * Diferente da query acima (só limite inferior, usada pra "mês corrente até agora") - esta
     * tem os dois limites, pra consultar um período arbitrário/passado (S5.7) sem trazer
     * registros de fora dele.
     */
    List<RegistroPonto> findByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThanOrderByMomentoAsc(
            Usuario usuario, Instant inicio, Instant fim);

    /** "Ausências" no resumo diário (`RelatorioDiarioService`) - mais barato que trazer a lista
     * inteira só pra checar se está vazia. */
    boolean existsByUsuarioAndMomentoGreaterThanEqualAndMomentoLessThan(Usuario usuario, Instant inicio, Instant fim);
}
