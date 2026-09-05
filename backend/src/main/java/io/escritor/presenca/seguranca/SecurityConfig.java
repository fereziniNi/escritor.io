package io.escritor.presenca.seguranca;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // /error precisa ser público: o forward interno do Boot para lá depois de um 403/404
                        // reentra nesta mesma cadeia como request anônima, e sem isso o entry point troca
                        // o status original por 401 antes do corpo do erro ser escrito.
                        // /ws/** também é público aqui de propósito: o WebSocket nativo do browser não
                        // permite setar o header Authorization no handshake, então a autenticação desse
                        // path é feita à parte, via query param, por ProjetoHandshakeInterceptor - não por
                        // este filtro. Deixar authenticated() aqui derrubaria todo handshake com 401 antes
                        // do interceptor sequer rodar.
                        // /integracoes/google/callback também é público: é a Google redirecionando o
                        // navegador de volta (S. "algo muito parecido com o agenda do google... ou ate
                        // mesmo integrar") - uma navegação de página inteira não carrega o header
                        // Authorization. Quem autentica essa requisição específica é o nonce de uso único
                        // (`state`), validado dentro de GoogleOAuthService#tratarCallback, não este filtro.
                        .requestMatchers("/health", "/auth/**", "/error", "/ws/**", "/integracoes/google/callback")
                        .permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(new JwtAuthenticationFilter(jwtService), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
