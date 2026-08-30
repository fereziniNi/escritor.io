package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.Mapa;
import io.escritor.presenca.escritorio.repository.MapaRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import org.springframework.stereotype.Service;

/**
 * PRD: "o cliente nunca é fonte de verdade sobre posição" - usado por {@code
 * PresencaWebSocketHandler} (S6.4) pra rejeitar posições que o cliente tenta reportar fora do
 * mapa. As dimensões do mapa ativo são cacheadas depois da primeira consulta - não há (nem está
 * planejado) nenhum endpoint que troque qual mapa está ativo em runtime (editor visual é fora de
 * escopo, PRD §1/§6), então recalcular a cada posição recebida só custaria uma consulta ao banco
 * sem nunca mudar o resultado.
 */
@Service
public class ValidadorPosicaoMapa {

    private final MapaRepository mapaRepository;

    private volatile Limites limitesCache;

    public ValidadorPosicaoMapa(MapaRepository mapaRepository) {
        this.mapaRepository = mapaRepository;
    }

    public boolean dentroDosLimites(int x, int y) {
        Limites limites = limites();
        return x >= 0 && y >= 0 && x < limites.larguraTiles() && y < limites.alturaTiles();
    }

    private Limites limites() {
        Limites atual = limitesCache;
        if (atual != null) {
            return atual;
        }
        Mapa mapa = mapaRepository.findFirstByAtivoTrue().orElseThrow(() -> new RecursoNaoEncontradoException("Nenhum mapa ativo"));
        Limites calculado = new Limites(mapa.getLarguraTiles(), mapa.getAlturaTiles());
        limitesCache = calculado;
        return calculado;
    }

    private record Limites(int larguraTiles, int alturaTiles) {
    }
}
