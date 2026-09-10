package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.kanban.service.RelatorioTrabalhoService;
import java.time.Instant;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Mesmos dois caminhos de sempre (`/apontamentos...`) - "onde o tempo foi", agora somando o
 * cronômetro ({@code SessaoTrabalho}) em vez do lançamento manual removido. */
@RestController
public class RelatorioTrabalhoController {

    private final RelatorioTrabalhoService relatorioTrabalhoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public RelatorioTrabalhoController(RelatorioTrabalhoService relatorioTrabalhoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.relatorioTrabalhoService = relatorioTrabalhoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping(value = "/apontamentos", params = "agrupar=card")
    public List<TotalPorCardResponse> listarTotalPorCard(
            @RequestParam(required = false) Long usuarioId, @RequestParam Instant inicio, @RequestParam Instant fim) {
        return relatorioTrabalhoService.listarTotalPorCard(usuarioId, inicio, fim, contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/apontamentos/relatorio")
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public TotalApontadoResponse totalApontadoPorProjeto(
            @RequestParam Long projetoId, @RequestParam Instant inicio, @RequestParam Instant fim) {
        return relatorioTrabalhoService.totalApontadoPorProjeto(projetoId, inicio, fim);
    }
}
