package io.escritor.presenca.googlecalendar.web;

import io.escritor.presenca.googlecalendar.service.GoogleOAuthService;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.ContextoUsuarioAutenticado;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do usuário: "algo muito parecido com o agenda do google... ou ate mesmo integrar". Cada
 * usuário conecta a própria conta - {@code /estado}, {@code /iniciar} e {@code DELETE} atuam
 * sempre sobre o usuário autenticado, sem parâmetro {@code usuarioId}, ninguém conecta em nome de
 * outro. Só {@code /callback} é público (ver {@code SecurityConfig}) - é a Google redirecionando
 * o navegador de volta, sem header de autenticação; quem autentica é o nonce de uso único no
 * {@code state}.
 */
@RestController
@RequestMapping("/integracoes/google")
public class IntegracaoGoogleController {

    private final GoogleOAuthService oAuthService;
    private final ContextoUsuarioAutenticado contextoUsuarioAutenticado;

    public IntegracaoGoogleController(GoogleOAuthService oAuthService, ContextoUsuarioAutenticado contextoUsuarioAutenticado) {
        this.oAuthService = oAuthService;
        this.contextoUsuarioAutenticado = contextoUsuarioAutenticado;
    }

    @GetMapping("/estado")
    public EstadoGoogleResponse estado() {
        boolean habilitado = oAuthService.habilitado();
        boolean conectado = habilitado && oAuthService.estaConectado(contextoUsuarioAutenticado.usuarioAtual());
        return new EstadoGoogleResponse(habilitado, conectado);
    }

    @GetMapping("/iniciar")
    public UrlAutorizacaoResponse iniciar() {
        Usuario usuario = contextoUsuarioAutenticado.usuarioAtual();
        return new UrlAutorizacaoResponse(oAuthService.iniciarConexao(usuario));
    }

    /** Sem {@code @Valid`/`@NotNull} de propósito: {@code code}/{@code state} podem vir ausentes
     * (usuário recusou o consentimento na tela da Google, que manda {@code error=access_denied}
     * em vez deles) - tratado como mais um caso de "erro", não uma requisição malformada. */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code, @RequestParam(required = false) String state) {
        if (code == null || state == null) {
            return redirecionarPro("/?google=erro");
        }
        try {
            oAuthService.tratarCallback(code, state);
            return redirecionarPro("/?google=conectado");
        } catch (RuntimeException erro) {
            return redirecionarPro("/?google=erro");
        }
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desconectar() {
        oAuthService.desconectar(contextoUsuarioAutenticado.usuarioAtual());
    }

    private static ResponseEntity<Void> redirecionarPro(String caminho) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(caminho)).build();
    }
}
