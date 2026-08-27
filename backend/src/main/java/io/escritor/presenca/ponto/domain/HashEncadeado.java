package io.escritor.presenca.ponto.domain;

import io.escritor.presenca.seguranca.HashSha256;
import java.time.Instant;

/**
 * Encadeamento de integridade do PRD §3.2: cada marcação de ponto inclui o hash da anterior
 * daquele usuário, então qualquer alteração retroativa em um registro já gravado quebra a
 * verificação de quem vier depois na cadeia (ver {@link VerificadorCadeiaPonto}).
 */
public final class HashEncadeado {

    private HashEncadeado() {
    }

    public static String calcular(
            Long usuarioId,
            TipoRegistroPonto tipo,
            Instant momento,
            OrigemRegistroPonto origem,
            String hashAnterior) {
        String entrada = usuarioId + "|" + tipo + "|" + momento + "|" + origem + "|"
                + (hashAnterior == null ? "" : hashAnterior);
        return HashSha256.hash(entrada);
    }
}
