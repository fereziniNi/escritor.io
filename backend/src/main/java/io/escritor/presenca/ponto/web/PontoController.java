package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.service.JornadaService;
import io.escritor.presenca.ponto.service.PontoService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
    public JornadaDoDiaResponse jornadaDoDia() {
        return jornadaService.jornadaDoDia(contextoUsuarioAutenticado.usuarioAtual());
    }
}
