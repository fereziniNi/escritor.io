package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.service.PontoService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ponto")
public class PontoController {

    private final PontoService pontoService;
    private final JornadaService jornadaService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public PontoController(
            PontoService pontoService, JornadaService jornadaService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.pontoService = pontoService;
        this.jornadaService = jornadaService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping("/marcar")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistroPontoResponse marcar(@Valid @RequestBody MarcarPontoRequest request, HttpServletRequest http) {
        return pontoService.marcar(
                contextoUsuarioAutenticado.usuarioAtual(), request.tipo(), http.getRemoteAddr(), http.getHeader("User-Agent"));
    }

    @GetMapping("/estado-atual")
    public EstadoAtualPontoResponse estadoAtual() {
        return pontoService.estadoAtual(contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/jornada-do-dia")
    public JornadaDoDiaResponse jornadaDoDia(@RequestParam(required = false) Long usuarioId) {
        return jornadaService.jornadaDoDia(usuarioId, contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/espelho-do-mes")
    public EspelhoMesResponse espelhoDoMes(@RequestParam(required = false) Long usuarioId) {
        return jornadaService.espelhoDoMes(usuarioId, contextoUsuarioAutenticado.usuarioAtual());
    }

    /**
     * CSV primeiro que PDF (S5.3) - `params = "formato=csv"` roteia pra este método mantendo a
     * mesma URL/query params do endpoint JSON, sem negociação de conteúdo via `Accept`.
     */
    @GetMapping(value = "/espelho-do-mes", params = "formato=csv")
    public ResponseEntity<String> espelhoDoMesCsv(@RequestParam(required = false) Long usuarioId) {
        EspelhoMesResponse espelho = jornadaService.espelhoDoMes(usuarioId, contextoUsuarioAutenticado.usuarioAtual());
        return ResponseEntity.ok().contentType(MediaType.valueOf("text/csv")).body(EspelhoMesCsv.gerar(espelho));
    }

    @GetMapping("/dias-inconsistentes")
    public List<LocalDate> diasInconsistentes(
            @RequestParam(required = false) Long usuarioId, @RequestParam Instant inicio, @RequestParam Instant fim) {
        return jornadaService.diasInconsistentes(usuarioId, inicio, fim, contextoUsuarioAutenticado.usuarioAtual());
    }
}
