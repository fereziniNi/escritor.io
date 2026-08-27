package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.service.PontoService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ponto")
public class PontoController {

    private final PontoService pontoService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public PontoController(PontoService pontoService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.pontoService = pontoService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping("/marcar")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistroPontoResponse marcar(@Valid @RequestBody MarcarPontoRequest request, HttpServletRequest http) {
        return pontoService.marcar(
                contextoUsuarioAutenticado.usuarioAtual(), request.tipo(), http.getRemoteAddr(), http.getHeader("User-Agent"));
    }
}
