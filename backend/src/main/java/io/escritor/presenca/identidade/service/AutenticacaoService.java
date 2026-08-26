package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.CodigoAcesso;
import io.escritor.presenca.identidade.domain.GeradorCodigo;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.CodigoAcessoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.email.EnvioEmail;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AutenticacaoService {

    private final UsuarioRepository usuarioRepository;
    private final CodigoAcessoRepository codigoAcessoRepository;
    private final PasswordEncoder passwordEncoder;
    private final EnvioEmail envioEmail;

    public AutenticacaoService(
            UsuarioRepository usuarioRepository,
            CodigoAcessoRepository codigoAcessoRepository,
            PasswordEncoder passwordEncoder,
            EnvioEmail envioEmail) {
        this.usuarioRepository = usuarioRepository;
        this.codigoAcessoRepository = codigoAcessoRepository;
        this.passwordEncoder = passwordEncoder;
        this.envioEmail = envioEmail;
    }

    public void solicitarCodigo(String email) {
        usuarioRepository.findByEmailAndAtivoTrue(email).ifPresent(this::gerarEEnviarCodigo);
    }

    private void gerarEEnviarCodigo(Usuario usuario) {
        invalidarCodigoAnterior(usuario);

        String codigo = GeradorCodigo.gerar();
        CodigoAcesso novo = new CodigoAcesso(usuario, passwordEncoder.encode(codigo));
        codigoAcessoRepository.save(novo);

        envioEmail.enviarCodigoAcesso(usuario.getEmail(), codigo);
    }

    private void invalidarCodigoAnterior(Usuario usuario) {
        codigoAcessoRepository
                .findFirstByUsuarioAndUsadoEmIsNullOrderByCriadoEmDesc(usuario)
                .ifPresent(anterior -> {
                    anterior.marcarUsado(Instant.now());
                    codigoAcessoRepository.save(anterior);
                });
    }
}
