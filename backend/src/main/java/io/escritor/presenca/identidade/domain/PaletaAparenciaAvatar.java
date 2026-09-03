package io.escritor.presenca.identidade.domain;

import java.util.Set;

/**
 * Paleta curada de cores pro editor de avatar - espelha EXATAMENTE
 * {@code frontend/src/features/escritorio/avatar/aparenciaAvatar.ts} (mesmos hex) - qualquer
 * mudança aqui precisa da mudança irmã lá, senão o editor mostra uma cor que o servidor rejeita.
 * Não é um color picker livre de propósito.
 *
 * <p>{@code CORES_GERAL} é compartilhada por Top/Jacket/Bottom/Shoes/Hat/Glasses/Other (7
 * categorias) em vez de uma paleta própria por categoria - é o que os prints de referência do
 * Gather mostram (a mesma fileira de cor se repete em quase toda categoria), e evita 7
 * {@code Set<String>} quase idênticos aqui.
 */
public final class PaletaAparenciaAvatar {

    public static final Set<String> CORES_PELE =
            Set.of("#ffe0bd", "#f7dcc4", "#f2c9a0", "#d9a066", "#b97a4b", "#8a5a34", "#5c3a22", "#3a2317");

    public static final Set<String> CORES_CABELO =
            Set.of("#1c1a28", "#4a3728", "#8a5a34", "#c9a24a", "#d6672e", "#e0e0e0", "#8a4fd6", "#4fa8d6", "#f2f2f2");

    public static final Set<String> CORES_GERAL = Set.of(
            "#1c1a28",
            "#2b2b3a",
            "#6b7280",
            "#8a5a34",
            "#c9a24a",
            "#e8a33d",
            "#e0546f",
            "#e874c4",
            "#8a4fd6",
            "#4472c4",
            "#4fa8d6",
            "#4f9f6f",
            "#2f6f45",
            "#c0392b",
            "#f2f2f2",
            "#ffffff");

    private PaletaAparenciaAvatar() {
    }

    public static void validar(
            String corPele,
            String corCabelo,
            String corTop,
            String corJaqueta,
            String corBottom,
            String corSapato,
            String corChapeu,
            String corOculos,
            String corOutro) {
        if (!CORES_PELE.contains(corPele)) {
            throw new AparenciaInvalidaException("Cor de pele fora da paleta: " + corPele);
        }
        if (!CORES_CABELO.contains(corCabelo)) {
            throw new AparenciaInvalidaException("Cor de cabelo fora da paleta: " + corCabelo);
        }
        validarCorGeral(corTop, "top");
        validarCorGeral(corJaqueta, "jaqueta");
        validarCorGeral(corBottom, "bottom");
        validarCorGeral(corSapato, "sapato");
        validarCorGeral(corChapeu, "chapéu");
        validarCorGeral(corOculos, "óculos");
        validarCorGeral(corOutro, "outro");
    }

    private static void validarCorGeral(String cor, String rotuloCategoria) {
        if (!CORES_GERAL.contains(cor)) {
            throw new AparenciaInvalidaException("Cor de " + rotuloCategoria + " fora da paleta: " + cor);
        }
    }
}
