package io.escritor.presenca.identidade.service;

import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;
import io.escritor.presenca.identidade.domain.EmailJaCadastradoException;
import io.escritor.presenca.identidade.domain.PaletaAparenciaAvatar;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AtualizarAparenciaRequest;
import io.escritor.presenca.identidade.web.AtualizarCargaDiariaRequest;
import io.escritor.presenca.identidade.web.AtualizarPerfilRequest;
import io.escritor.presenca.identidade.web.CriarUsuarioRequest;
import io.escritor.presenca.identidade.web.UsuarioBasicoResponse;
import io.escritor.presenca.identidade.web.UsuarioResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PresencaWebSocketHandler presencaWebSocketHandler;

    public UsuarioService(UsuarioRepository usuarioRepository, PresencaWebSocketHandler presencaWebSocketHandler) {
        this.usuarioRepository = usuarioRepository;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
    }

    public UsuarioResponse criar(CriarUsuarioRequest request) {
        Usuario usuario = new Usuario(
                request.nome(),
                request.email(),
                request.papel(),
                request.cargaDiariaMinutos());

        Usuario salvo = usuarioRepository.save(usuario);

        return UsuarioResponse.de(salvo);
    }

    /** Tela de admin "gerenciar colaboradores" (pedido do usuário) - lista todo mundo, sem
     * paginação (mesmo padrão simples de {@code ProjetoService.listarVisiveis}, volume esperado é baixo). */
    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAll().stream().map(UsuarioResponse::de).toList();
    }

    /**
     * Pedido do cliente: referenciar pessoa por nome (não id) em qualquer lugar do sistema -
     * autocomplete de "escolher uma pessoa" (adicionar membro, atribuir responsável, filtrar
     * relatório) usa esta listagem enxuta em vez de {@link #listar()} (que é ADMIN-only e expõe
     * papel/carga diária). Só usuários ativos - não faz sentido sugerir/atribuir algo a alguém
     * desligado. Ordenado por nome pro autocomplete já vir organizado, sem o front precisar
     * ordenar de novo.
     */
    public List<UsuarioBasicoResponse> listarBasico() {
        return usuarioRepository.findByAtivoTrueOrderByNomeAsc().stream().map(UsuarioBasicoResponse::de).toList();
    }

    /** ADMIN-only (diferente de {@link #atualizarMeuPerfil}, self-service) - pedido do usuário:
     * "o admin deve definir [a carga diária] para os outros funcionários, não deve ser padrão".
     * `papel` continua sem tela de edição, fora de escopo aqui. */
    public UsuarioResponse atualizarCargaDiaria(Long usuarioId, AtualizarCargaDiariaRequest request) {
        Usuario usuario = usuarioRepository
                .findById(usuarioId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado"));

        usuario.alterarCargaDiaria(request.cargaDiariaMinutos());
        Usuario salvo = usuarioRepository.save(usuario);

        return UsuarioResponse.de(salvo);
    }

    /**
     * Pedido do usuário: "a opção para todos detalhar da melhor maneira possível o avatar" -
     * self-service, diferente de {@link #atualizarCargaDiaria} (ADMIN-only): {@code
     * usuarioAutenticado} já vem resolvido de {@code ContextoUsuarioAutenticado.usuarioAtual()},
     * então não existe "editar a aparência de outra pessoa" pra checar aqui, mesma garantia
     * estrutural que {@code SessaoTrabalhoController} já usa em outro contexto.
     */
    public UsuarioResponse buscarMeuUsuario(Usuario usuarioAutenticado) {
        return UsuarioResponse.de(usuarioAutenticado);
    }

    /**
     * Pedido do usuário: "a opção para todos detalhar da melhor maneira possível o avatar" - volta
     * a existir depois de uma passagem por sprites prontos (Kenney), por pedido explícito do
     * usuário ("voltar ao sistema desenhado à mão, bem mais detalhado"). Valida as 3 cores contra a
     * paleta curada ({@link PaletaAparenciaAvatar#validar}) antes de salvar - os 4 campos de estilo
     * (incluindo `tipoBarba`) já são enums fechados, o Jackson rejeita valor fora deles antes de
     * chegar aqui. Notifica quem já está conectado no mundo assim que salva - sem isso, colegas só
     * veriam a aparência nova depois de reconectar (ver
     * {@link PresencaWebSocketHandler#atualizarAparencia}).
     */
    public UsuarioResponse atualizarMinhaAparencia(Usuario usuarioAutenticado, AtualizarAparenciaRequest request) {
        PaletaAparenciaAvatar.validar(
                request.corPele(),
                request.corCabelo(),
                request.corTop(),
                request.corJaqueta(),
                request.corBottom(),
                request.corSapato(),
                request.corChapeu(),
                request.corOculos(),
                request.corOutro());

        AparenciaAvatar novaAparencia = new AparenciaAvatar(
                request.corPele(),
                request.tipoCorpo(),
                request.tipoRosto(),
                request.estiloCabelo(),
                request.corCabelo(),
                request.tipoBarba(),
                request.estiloTop(),
                request.corTop(),
                request.estiloJaqueta(),
                request.corJaqueta(),
                request.estiloBottom(),
                request.corBottom(),
                request.estiloSapato(),
                request.corSapato(),
                request.chapeu(),
                request.corChapeu(),
                request.oculos(),
                request.corOculos(),
                request.estiloOutro(),
                request.corOutro());
        usuarioAutenticado.alterarAparencia(novaAparencia);
        Usuario salvo = usuarioRepository.save(usuarioAutenticado);

        presencaWebSocketHandler.atualizarAparencia(salvo.getId(), novaAparencia);

        return UsuarioResponse.de(salvo);
    }

    /**
     * Pedido do usuário: "edição de perfil. Nome e email nesse modal" - self-service, mesmo
     * espírito de {@link #atualizarMinhaAparencia} (não existe "editar o perfil de outra pessoa"
     * pra checar aqui). E-mail duplicado não pode virar um 500 de violação de constraint do banco -
     * checa explicitamente antes de salvar (`findByEmailAndAtivoTrue` já existe, usado hoje pelo
     * login); sem efeito quando a pessoa manda o próprio e-mail de volta sem mudar nada.
     */
    public UsuarioResponse atualizarMeuPerfil(Usuario usuarioAutenticado, AtualizarPerfilRequest request) {
        boolean emailMudou = !request.email().equalsIgnoreCase(usuarioAutenticado.getEmail());
        if (emailMudou) {
            usuarioRepository.findByEmailAndAtivoTrue(request.email()).ifPresent(outro -> {
                if (!outro.getId().equals(usuarioAutenticado.getId())) {
                    throw new EmailJaCadastradoException("Esse e-mail já está em uso por outra pessoa");
                }
            });
        }

        usuarioAutenticado.alterarPerfil(request.nome(), request.email());
        Usuario salvo = usuarioRepository.save(usuarioAutenticado);

        return UsuarioResponse.de(salvo);
    }
}
