package io.escritor.presenca.reuniao.repository;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.reuniao.domain.Reuniao;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReuniaoRepository extends JpaRepository<Reuniao, Long> {

    List<Reuniao> findByCriadorAndDataBetween(Usuario criador, LocalDate inicio, LocalDate fim);

    List<Reuniao> findByParticipantes_UsuarioAndDataBetween(Usuario usuario, LocalDate inicio, LocalDate fim);

    List<Reuniao> findByParticipantes_UsuarioAndData(Usuario usuario, LocalDate data);

    /** {@code Distinct} de propósito - uma reunião com mais de um participante dentro de
     * {@code usuarios} apareceria repetida sem isso (um join por participante que bate). */
    List<Reuniao> findDistinctByParticipantes_UsuarioInAndDataBetween(List<Usuario> usuarios, LocalDate inicio, LocalDate fim);

    Optional<Reuniao> findByIdAndCriador(Long id, Usuario criador);
}
