package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.relatorio.service.EstatisticasService;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Dashboard de estatísticas de Relatórios (`RelatoriosPage`) - um endpoint só, agregando ponto,
 * kanban e reunião, em vez do frontend juntar várias chamadas na mão. */
@RestController
public class EstatisticasController {

    private final EstatisticasService estatisticasService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public EstatisticasController(EstatisticasService estatisticasService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.estatisticasService = estatisticasService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/relatorios/estatisticas")
    public EstatisticasResponse estatisticas(
            @RequestParam(required = false) Long usuarioId, @RequestParam Instant inicio, @RequestParam Instant fim) {
        return estatisticasService.calcular(usuarioId, inicio, fim, contextoUsuarioAutenticado.usuarioAtual());
    }
}
