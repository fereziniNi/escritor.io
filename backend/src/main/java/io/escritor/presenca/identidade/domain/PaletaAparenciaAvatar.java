package io.escritor.presenca.identidade.domain;

import java.util.Set;

/**
 * Paleta curada de cores pro editor de avatar - espelha EXATAMENTE
 * {@code frontend/src/features/escritorio/avatar/aparenciaAvatar.ts} (mesmos hex) - qualquer
 * mudança aqui precisa da mudança irmã lá, senão o editor mostra uma cor que o servidor rejeita.
 * Não é um color picker livre de propósito (mais fácil de manter tudo combinando visualmente,
 * igual à grade de swatches do editor do Gather usado como referência de composição de UI).
 */
public final class PaletaAparenciaAvatar {

    public static final Set<String> CORES_PELE = Set.of("#f7dcc4", "#f2c9a0", "#d9a066", "#b97a4b", "#8a5a34", "#5c3a22");

    public static final Set<String> CORES_CABELO =
            Set.of("#1c1a28", "#4a3728", "#8a5a34", "#c9a24a", "#d6672e", "#e0e0e0", "#8a4fd6", "#4fa8d6");

    public static final Set<String> CORES_ROUPA = Set.of(
            "#6b7280", "#e0546f", "#4472c4", "#4f9f6f", "#e8a33d", "#8a5a34", "#2b2b3a", "#f2f2f2", "#8a4fd6", "#e874c4");

    private PaletaAparenciaAvatar() {
    }

    public static void validar(String corPele, String corCabelo, String corRoupa) {
        if (!CORES_PELE.contains(corPele)) {
            throw new AparenciaInvalidaException("Cor de pele fora da paleta: " + corPele);
        }
        if (!CORES_CABELO.contains(corCabelo)) {
            throw new AparenciaInvalidaException("Cor de cabelo fora da paleta: " + corCabelo);
        }
        if (!CORES_ROUPA.contains(corRoupa)) {
            throw new AparenciaInvalidaException("Cor de roupa fora da paleta: " + corRoupa);
        }
    }
}
