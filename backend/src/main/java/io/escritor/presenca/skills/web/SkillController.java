package io.escritor.presenca.skills.web;

import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import io.escritor.presenca.skills.domain.CategoriaSkill;
import io.escritor.presenca.skills.service.SkillConsultaService;
import io.escritor.presenca.skills.service.SkillFachada;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do usuário: catálogo de skills da Multiplica dentro do app. Todas as rotas exigem
 * autenticação; aprovar, rejeitar, oficializar, arquivar e a fila de propostas são só de
 * GESTOR/ADMIN (aqui com {@code @PreAuthorize} e de novo no serviço). As rotas literais
 * ({@code /skills/propostas}, {@code /skills/oficiais.zip}) têm precedência sobre {@code /skills/{slug}}.
 */
@RestController
public class SkillController {

    private static final MediaType ZIP = MediaType.parseMediaType("application/zip");

    private final SkillFachada fachada;
    private final SkillConsultaService consulta;
    private final ContextoUsuarioAutenticado contexto;

    public SkillController(SkillFachada fachada, SkillConsultaService consulta, ContextoUsuarioAutenticado contexto) {
        this.fachada = fachada;
        this.consulta = consulta;
        this.contexto = contexto;
    }

    @GetMapping("/skills")
    public List<SkillResumoResponse> listar(@RequestParam(required = false) String busca,
            @RequestParam(required = false) CategoriaSkill categoria,
            @RequestParam(name = "oficial", required = false) Boolean oficial,
            @RequestParam(name = "arquivadas", defaultValue = "false") boolean arquivadas) {
        return fachada.listar(busca, categoria, oficial, arquivadas);
    }

    @GetMapping("/skills/propostas")
    @PreAuthorize("hasAnyRole('GESTOR','ADMIN')")
    public List<PropostaResponse> propostas() {
        return fachada.propostas();
    }

    @GetMapping("/skills/oficiais.zip")
    public ResponseEntity<byte[]> oficiaisZip() {
        return zip(consulta.zipDasOficiais(), "skills-oficiais-multiplica");
    }

    @GetMapping("/skills/{slug}")
    public SkillDetalheResponse detalhe(@PathVariable String slug) {
        return fachada.detalhe(slug);
    }

    @GetMapping("/skills/{slug}/versoes")
    public List<VersaoResumoResponse> versoes(@PathVariable String slug) {
        return fachada.versoes(slug);
    }

    @GetMapping("/skills/{slug}/versoes/{numero}")
    public SkillVersaoResponse versao(@PathVariable String slug, @PathVariable int numero) {
        return fachada.versao(slug, numero);
    }

    @GetMapping("/skills/{slug}/zip")
    public ResponseEntity<byte[]> zipDaSkill(@PathVariable String slug,
            @RequestParam(name = "versao", required = false) Integer versao) {
        return zip(consulta.zipDaSkill(slug, versao), slug);
    }

    @PostMapping("/skills")
    @ResponseStatus(HttpStatus.CREATED)
    public SkillVersaoResponse criar(@RequestBody CriarSkillRequest request) {
        return fachada.criar(request, contexto.usuarioAtual());
    }

    @PostMapping("/skills/{slug}/versoes")
    public SkillVersaoResponse salvar(@PathVariable String slug, @RequestBody SalvarVersaoRequest request) {
        return fachada.salvar(slug, request, contexto.usuarioAtual());
    }

    @PostMapping("/skills/{slug}/versoes/{numero}/restaurar")
    public SkillVersaoResponse restaurar(@PathVariable String slug, @PathVariable int numero) {
        return fachada.restaurar(slug, numero, contexto.usuarioAtual());
    }

    @PostMapping("/skills/{slug}/versoes/{numero}/aprovar")
    @PreAuthorize("hasAnyRole('GESTOR','ADMIN')")
    public SkillVersaoResponse aprovar(@PathVariable String slug, @PathVariable int numero) {
        return fachada.aprovar(slug, numero, contexto.usuarioAtual());
    }

    @PostMapping("/skills/{slug}/versoes/{numero}/rejeitar")
    @PreAuthorize("hasAnyRole('GESTOR','ADMIN')")
    public SkillVersaoResponse rejeitar(@PathVariable String slug, @PathVariable int numero,
            @RequestBody DecisaoRequest request) {
        return fachada.rejeitar(slug, numero, contexto.usuarioAtual(), request.motivo());
    }

    @PutMapping("/skills/{slug}/oficial")
    @PreAuthorize("hasAnyRole('GESTOR','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void oficial(@PathVariable String slug, @RequestBody FlagRequest request) {
        fachada.definirOficial(slug, request.valor(), contexto.usuarioAtual());
    }

    @PutMapping("/skills/{slug}/arquivada")
    @PreAuthorize("hasAnyRole('GESTOR','ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void arquivada(@PathVariable String slug, @RequestBody FlagRequest request) {
        fachada.definirArquivada(slug, request.valor(), contexto.usuarioAtual());
    }

    private static ResponseEntity<byte[]> zip(byte[] bytes, String nomeArquivo) {
        return ResponseEntity.ok()
                .contentType(ZIP)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nomeArquivo + ".zip\"")
                .body(bytes);
    }
}
