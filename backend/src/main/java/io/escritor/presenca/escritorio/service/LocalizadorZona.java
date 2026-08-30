package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Usado por {@code PresencaWebSocketHandler} (S6.7) pra saber se uma posição cai dentro de
 * alguma zona - status automático por zona (PRD). Mesma estratégia de cache de
 * {@link ValidadorPosicaoMapa}: as zonas do mapa ativo são consultadas uma vez e cacheadas pra
 * sempre, porque não há (nem está planejado) jeito de trocar o mapa ativo ou suas zonas em
 * runtime.
 */
@Service
public class LocalizadorZona {

    private final MapaRepository mapaRepository;
    private final ZonaRepository zonaRepository;

    private volatile List<Zona> zonasCache;

    public LocalizadorZona(MapaRepository mapaRepository, ZonaRepository zonaRepository) {
        this.mapaRepository = mapaRepository;
        this.zonaRepository = zonaRepository;
    }

    public Optional<Zona> zonaContendo(int x, int y) {
        return zonas().stream()
                .filter(zona -> x >= zona.getX() && x < zona.getX() + zona.getLargura() && y >= zona.getY() && y < zona.getY() + zona.getAltura())
                .findFirst();
    }

    private List<Zona> zonas() {
        List<Zona> atual = zonasCache;
        if (atual != null) {
            return atual;
        }
        Mapa mapa = mapaRepository.findFirstByAtivoTrue().orElseThrow(() -> new RecursoNaoEncontradoException("Nenhum mapa ativo"));
        List<Zona> calculado = zonaRepository.findByMapa(mapa);
        zonasCache = calculado;
        return calculado;
    }
}
