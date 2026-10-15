package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.service.FechamentoMesService;
import java.time.YearMonth;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Fechamento mensal de horas de todas as pessoas - só ADMIN (horas e saldo de todo mundo, não só
 * de quem divide projeto, como o espelho via `VisibilidadeUsuarioService`).
 */
@RestController
@RequestMapping("/admin/ponto/fechamento-mensal")
public class FechamentoMesController {

    private static final MediaType XLSX =
            MediaType.valueOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final FechamentoMesService fechamentoMesService;

    public FechamentoMesController(FechamentoMesService fechamentoMesService) {
        this.fechamentoMesService = fechamentoMesService;
    }

    /** `mes` (AAAA-MM) opcional: ausente = mês corrente. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public FechamentoMesResponse fechamento(@RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth mes) {
        return fechamentoMesService.fechamento(mes);
    }

    @GetMapping(params = "formato=xlsx")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> fechamentoXlsx(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth mes) {
        FechamentoMesResponse fechamento = fechamentoMesService.fechamento(mes);
        return ResponseEntity.ok()
                .contentType(XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fechamento-" + fechamento.mes() + ".xlsx\"")
                .body(FechamentoMesXlsx.gerar(fechamento));
    }
}
