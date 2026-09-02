package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.kanban.service.ColunaService;
import io.escritor.presenca.kanban.service.EtiquetaService;
import io.escritor.presenca.kanban.web.ColunaResponse;
import io.escritor.presenca.kanban.web.CriarColunaRequest;
import io.escritor.presenca.kanban.web.CriarEtiquetaRequest;
import io.escritor.presenca.kanban.web.EtiquetaResponse;
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

/**
 * Pedido do cliente (via usuário): "remova essa parte de quadro, vamos trabalhar apenas com
 * projeto" - este controller absorve por completo o que era {@code QuadroController} (colunas,
 * etiquetas, membros), além de criar/listar projeto que já existia. Criar continua GESTOR/ADMIN
 * (mesmo papel que já criava quadro antes da fusão - só listar/ver detalhe é aberto a qualquer
 * autenticado, e mesmo assim filtrado por visibilidade em {@link ProjetoService#listarVisiveis}).
 */
@RestController
@RequestMapping("/projetos")
public class ProjetoController {

    private final ProjetoService projetoService;
    private final ColunaService colunaService;
    private final EtiquetaService etiquetaService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ProjetoController(
            ProjetoService projetoService,
            ColunaService colunaService,
            EtiquetaService etiquetaService,
            ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.projetoService = projetoService;
        this.colunaService = colunaService;
        this.etiquetaService = etiquetaService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public ProjetoResponse criar(@Valid @RequestBody CriarProjetoRequest request) {
        return projetoService.criar(request, contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping
    public List<ProjetoResponse> listar() {
        return projetoService.listarVisiveis(contextoUsuarioAutenticado.usuarioAtual());
    }

    @GetMapping("/{id}")
    public ProjetoDetalheResponse buscarDetalhe(@PathVariable Long id) {
        return projetoService.buscarDetalhe(id, contextoUsuarioAutenticado.usuarioAtual());
    }

    @PostMapping("/{id}/membros")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public void adicionarMembro(@PathVariable Long id, @Valid @RequestBody AdicionarMembroProjetoRequest request) {
        projetoService.adicionarMembro(id, request);
    }

    @PostMapping("/{id}/colunas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public ColunaResponse criarColuna(@PathVariable Long id, @Valid @RequestBody CriarColunaRequest request) {
        return colunaService.criar(id, request.nome(), request.ordem(), request.limiteWip());
    }

    @PostMapping("/{id}/etiquetas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('GESTOR', 'ADMIN')")
    public EtiquetaResponse criarEtiqueta(@PathVariable Long id, @Valid @RequestBody CriarEtiquetaRequest request) {
        return etiquetaService.criar(id, request.nome(), request.cor());
    }

    @GetMapping("/{id}/etiquetas")
    public List<EtiquetaResponse> listarEtiquetas(@PathVariable Long id) {
        return etiquetaService.listar(id);
    }
}
