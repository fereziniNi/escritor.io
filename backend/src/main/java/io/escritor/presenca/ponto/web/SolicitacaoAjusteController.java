package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.service.SolicitacaoAjusteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ajustes")
public class SolicitacaoAjusteController {

    private final SolicitacaoAjusteService solicitacaoAjusteService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public SolicitacaoAjusteController(
            SolicitacaoAjusteService solicitacaoAjusteService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.solicitacaoAjusteService = solicitacaoAjusteService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SolicitacaoAjusteResponse solicitar(@Valid @RequestBody CriarSolicitacaoAjusteRequest request) {
        return solicitacaoAjusteService.solicitar(
                contextoUsuarioAutenticado.usuarioAtual(),
                request.tipo(),
                request.momento(),
                request.registroAlvoId(),
                request.justificativa());
    }
}
