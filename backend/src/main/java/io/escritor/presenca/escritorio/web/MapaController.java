package io.escritor.presenca.escritorio.web;

import io.escritor.presenca.escritorio.service.MapaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/mapas")
public class MapaController {

    private final MapaService mapaService;

    public MapaController(MapaService mapaService) {
        this.mapaService = mapaService;
    }

    @GetMapping("/ativo")
    public MapaDetalheResponse buscarAtivo() {
        return mapaService.buscarAtivo();
    }
}
