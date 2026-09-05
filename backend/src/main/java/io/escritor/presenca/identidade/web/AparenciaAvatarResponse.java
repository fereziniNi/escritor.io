package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.EstiloBottom;
import io.escritor.presenca.identidade.domain.EstiloCabelo;
import io.escritor.presenca.identidade.domain.EstiloJaqueta;
import io.escritor.presenca.identidade.domain.EstiloOutro;
import io.escritor.presenca.identidade.domain.EstiloSapato;
import io.escritor.presenca.identidade.domain.EstiloTop;
import io.escritor.presenca.identidade.domain.TipoBarba;
import io.escritor.presenca.identidade.domain.TipoChapeu;
import io.escritor.presenca.identidade.domain.TipoCorpo;
import io.escritor.presenca.identidade.domain.TipoOculos;
import io.escritor.presenca.identidade.domain.TipoRosto;

public record AparenciaAvatarResponse(
        String corPele,
        TipoCorpo tipoCorpo,
        TipoRosto tipoRosto,
        EstiloCabelo estiloCabelo,
        String corCabelo,
        TipoBarba tipoBarba,
        EstiloTop estiloTop,
        String corTop,
        EstiloJaqueta estiloJaqueta,
        String corJaqueta,
        EstiloBottom estiloBottom,
        String corBottom,
        EstiloSapato estiloSapato,
        String corSapato,
        TipoChapeu chapeu,
        String corChapeu,
        TipoOculos oculos,
        String corOculos,
        EstiloOutro estiloOutro,
        String corOutro) {

    public static AparenciaAvatarResponse de(AparenciaAvatar aparencia) {
        return new AparenciaAvatarResponse(
                aparencia.getCorPele(),
                aparencia.getTipoCorpo(),
                aparencia.getTipoRosto(),
                aparencia.getEstiloCabelo(),
                aparencia.getCorCabelo(),
                aparencia.getTipoBarba(),
                aparencia.getEstiloTop(),
                aparencia.getCorTop(),
                aparencia.getEstiloJaqueta(),
                aparencia.getCorJaqueta(),
                aparencia.getEstiloBottom(),
                aparencia.getCorBottom(),
                aparencia.getEstiloSapato(),
                aparencia.getCorSapato(),
                aparencia.getChapeu(),
                aparencia.getCorChapeu(),
                aparencia.getOculos(),
                aparencia.getCorOculos(),
                aparencia.getEstiloOutro(),
                aparencia.getCorOutro());
    }
}
