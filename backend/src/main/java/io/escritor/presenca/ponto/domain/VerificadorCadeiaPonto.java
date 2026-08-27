package io.escritor.presenca.ponto.domain;

import java.util.List;
import java.util.Objects;

/**
 * Verifica uma cadeia de marcações de um usuário, em ordem cronológica. Detecta dois tipos de
 * adulteração: um registro cujo hash não bate mais com seus próprios campos (alterado
 * diretamente no banco), e um registro cujo hash_anterior não é de fato o hash do registro
 * anterior na cadeia (fabricado de forma autoconsistente, mas sem encadear de verdade).
 */
public final class VerificadorCadeiaPonto {

    private VerificadorCadeiaPonto() {
    }

    public static boolean cadeiaValida(List<RegistroPonto> registrosEmOrdemCronologica) {
        String hashAnteriorEsperado = null;

        for (RegistroPonto registro : registrosEmOrdemCronologica) {
            if (!registro.hashValido()) {
                return false;
            }
            if (!Objects.equals(registro.getHashAnterior(), hashAnteriorEsperado)) {
                return false;
            }
            hashAnteriorEsperado = registro.getHash();
        }

        return true;
    }
}
