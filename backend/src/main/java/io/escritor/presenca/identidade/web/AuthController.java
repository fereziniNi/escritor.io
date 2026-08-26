package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.AutenticacaoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AutenticacaoService autenticacaoService;

    public AuthController(AutenticacaoService autenticacaoService) {
        this.autenticacaoService = autenticacaoService;
    }

    @PostMapping("/codigo")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void solicitarCodigo(@Valid @RequestBody SolicitarCodigoRequest request) {
        autenticacaoService.solicitarCodigo(request.email());
    }
}
