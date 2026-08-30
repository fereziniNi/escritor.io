package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.escritorio.web.MapaDetalheResponse;
import io.escritor.presenca.escritorio.web.ZonaResponse;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import org.springframework.stereotype.Service;

@Service
public class MapaService {

    private final MapaRepository mapaRepository;
    private final ZonaRepository zonaRepository;

    public MapaService(MapaRepository mapaRepository, ZonaRepository zonaRepository) {
        this.mapaRepository = mapaRepository;
        this.zonaRepository = zonaRepository;
    }

    public MapaDetalheResponse buscarAtivo() {
        Mapa mapa = mapaRepository.findFirstByAtivoTrue().orElseThrow(() -> new RecursoNaoEncontradoException("Nenhum mapa ativo"));

        return new MapaDetalheResponse(
                mapa.getId(),
                mapa.getNome(),
                mapa.getLarguraTiles(),
                mapa.getAlturaTiles(),
                mapa.getLayoutJson(),
                zonaRepository.findByMapa(mapa).stream()
                        .map(zona -> new ZonaResponse(
                                zona.getId(), zona.getNome(), zona.getX(), zona.getY(), zona.getLargura(), zona.getAltura(), zona.getTipo()))
                        .toList());
    }
}
