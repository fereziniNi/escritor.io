package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.EquipeService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/equipes")
public class EquipeController {

    private final EquipeService equipeService;

    public EquipeController(EquipeService equipeService) {
        this.equipeService = equipeService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public EquipeResponse criar(@Valid @RequestBody CriarEquipeRequest request) {
        return equipeService.criar(request);
    }

    @GetMapping
    public List<EquipeResponse> listar() {
        return equipeService.listar();
    }

    @PostMapping("/{id}/membros")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void adicionarMembro(@PathVariable Long id, @Valid @RequestBody AdicionarMembroRequest request) {
        equipeService.adicionarMembro(id, request);
    }
}
