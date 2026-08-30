package io.escritor.presenca.escritorio.web;

import io.escritor.presenca.escritorio.domain.TipoZona;

public record ZonaResponse(Long id, String nome, int x, int y, int largura, int altura, TipoZona tipo) {
}
