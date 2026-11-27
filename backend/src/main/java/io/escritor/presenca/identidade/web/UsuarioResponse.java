package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.infra.ClockConfig;
import java.time.LocalDate;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        Papel papel,
        Integer cargaDiariaMinutos,
        boolean ativo,
        AparenciaAvatarResponse aparencia,
        String whatsapp) {

    public static UsuarioResponse de(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getPapel(),
                // carga EM VIGOR hoje (pode ter uma mudança agendada que já começou a valer)
                usuario.cargaDiariaEm(LocalDate.now(ClockConfig.FUSO_EMPRESA)),
                usuario.isAtivo(),
                AparenciaAvatarResponse.de(usuario.getAparencia()),
                usuario.getWhatsapp());
    }
}
