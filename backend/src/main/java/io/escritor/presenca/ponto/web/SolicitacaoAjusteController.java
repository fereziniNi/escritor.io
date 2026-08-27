package io.escritor.presenca.ponto.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.ponto.service.AprovacaoAjusteService;
import io.escritor.presenca.ponto.service.SolicitacaoAjusteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ajustes")
public class SolicitacaoAjusteController {

    private final SolicitacaoAjusteService solicitacaoAjusteService;
    private final AprovacaoAjusteService aprovacaoAjusteService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public SolicitacaoAjusteController(
            SolicitacaoAjusteService solicitacaoAjusteService,
            AprovacaoAjusteService aprovacaoAjusteService,
            ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.solicitacaoAjusteService = solicitacaoAjusteService;
        this.aprovacaoAjusteService = aprovacaoAjusteService;
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

    @PostMapping("/{id}/aprovar")
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public SolicitacaoAjusteResponse aprovar(
            @PathVariable Long id, @RequestBody(required = false) AvaliarSolicitacaoRequest request) {
        String parecer = request == null ? null : request.parecer();
        return aprovacaoAjusteService.aprovar(id, contextoUsuarioAutenticado.usuarioAtual(), parecer);
    }

    @PostMapping("/{id}/rejeitar")
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public SolicitacaoAjusteResponse rejeitar(
            @PathVariable Long id, @RequestBody(required = false) AvaliarSolicitacaoRequest request) {
        String parecer = request == null ? null : request.parecer();
        return aprovacaoAjusteService.rejeitar(id, contextoUsuarioAutenticado.usuarioAtual(), parecer);
    }
}
