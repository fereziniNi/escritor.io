package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Personagem;
import jakarta.validation.constraints.NotNull;

/** `personagem` é um enum tipado - o Jackson já rejeita um valor fora dos 6 sprites disponíveis
 * com 400 antes mesmo de chegar no controller, sem precisar de validação de paleta manual (o
 * sistema por camadas/cor livre saiu, ver `Personagem.java`). */
public record AtualizarPersonagemRequest(@NotNull Personagem personagem) {
}
