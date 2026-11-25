package io.escritor.presenca.seguranca;

import io.escritor.presenca.identidade.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIXO_BEARER = "Bearer ";

    private final JwtService jwtService;

    private final ObjectProvider<UsuarioRepository> usuarioRepository;

    public JwtAuthenticationFilter(JwtService jwtService, ObjectProvider<UsuarioRepository> usuarioRepository) {
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith(PREFIXO_BEARER)) {
            String token = header.substring(PREFIXO_BEARER.length());

            jwtService.validar(token).ifPresent(jws -> {
                String usuarioId = jws.getPayload().getSubject();
                // usuário desligado (ativo = false) perde o acesso na hora, sem esperar o JWT
                // expirar - segue anônimo e cai no 401 do entry point.
                if (usuarioRepository.getObject().existsByIdAndAtivoFalse(Long.valueOf(usuarioId))) {
                    return;
                }
                String papel = jws.getPayload().get("papel", String.class);
                var authority = new SimpleGrantedAuthority("ROLE_" + papel);
                var authentication =
                        new UsernamePasswordAuthenticationToken(usuarioId, null, List.of(authority));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }

        filterChain.doFilter(request, response);
    }
}
