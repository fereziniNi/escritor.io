package io.escritor.presenca.escala.web;

import java.util.List;

public record EscalaEquipeResponse(Long usuarioId, String usuarioNome, List<DiaEfetivoResponse> dias) {
}
