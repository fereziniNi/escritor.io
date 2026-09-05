package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.identidade.service.ProjetoService;
import io.escritor.presenca.kanban.service.ColunaService;
import io.escritor.presenca.kanban.web.ColunaResponse;
import io.escritor.presenca.kanban.web.CriarColunaRequest;
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
 * membros), além de criar/listar projeto que já existia.
 *
 * <p>Criar projeto e criar coluna eram GESTOR/ADMIN só (mesmo papel que já criava quadro antes da
 * fusão) - o usuário pediu pra abrir os dois pra qualquer funcionário ("Um funcionário pode
 * adicionar seções e também adicionar novos projetos"), então {@code criar}/{@code criarColuna}
 * não têm mais {@code @PreAuthorize} de papel (só a autenticação padrão do
 * {@code SecurityConfig}, igual a qualquer outro endpoint). {@code adicionarMembro} não foi
 * mencionado no pedido - continua
 * GESTOR/ADMIN. Listar/ver detalhe já era aberto a qualquer autenticado, filtrado por
 * visibilidade em {@link ProjetoService#listarVisiveis}.
 */
@RestController
@RequestMapping("/projetos")
public class ProjetoController {

    private final ProjetoService projetoService;
    private final ColunaService colunaService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public ProjetoController(
            ProjetoService projetoService, ColunaService colunaService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.projetoService = projetoService;
        this.colunaService = colunaService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
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
    public ColunaResponse criarColuna(@PathVariable Long id, @Valid @RequestBody CriarColunaRequest request) {
        return colunaService.criar(id, request.nome(), request.ordem(), request.limiteWip());
    }
}
