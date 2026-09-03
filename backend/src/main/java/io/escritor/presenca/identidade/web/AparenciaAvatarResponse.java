package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloRoupa;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoOculos;

public record AparenciaAvatarResponse(
        String corPele,
        EstiloCabelo estiloCabelo,
        String corCabelo,
        EstiloRoupa estiloRoupa,
        String corRoupa,
        TipoOculos oculos,
        TipoChapeu chapeu,
        TipoBarba tipoBarba) {

    public static AparenciaAvatarResponse de(AparenciaAvatar aparencia) {
        return new AparenciaAvatarResponse(
                aparencia.getCorPele(),
                aparencia.getEstiloCabelo(),
                aparencia.getCorCabelo(),
                aparencia.getEstiloRoupa(),
                aparencia.getCorRoupa(),
                aparencia.getOculos(),
                aparencia.getChapeu(),
                aparencia.getTipoBarba());
    }
}
