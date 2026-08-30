package io.escritor.presenca.escritorio.web;

import java.util.List;

public record MapaDetalheResponse(
        Long id, String nome, int larguraTiles, int alturaTiles, String layoutJson, List<ZonaResponse> zonas) {
}
