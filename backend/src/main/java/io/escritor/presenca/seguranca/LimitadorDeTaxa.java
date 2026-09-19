package io.escritor.presenca.seguranca;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import org.springframework.stereotype.Component;

/**
 * Auditoria de segurança (VULN-05, MEDIUM): {@code /auth/codigo}/{@code /auth/login} não tinham
 * nenhum limite por IP - só o cooldown de 30s e o teto de 5 tentativas *por código* já existentes
 * em {@link io.escritor.presenca.identidade.service.AutenticacaoService}, que protegem uma conta
 * específica mas não impedem alguém de varrer várias contas, nem de "bombardear" o e-mail de uma
 * vítima disparando {@code /auth/codigo} repetidamente pra ela (o cooldown é por conta, não
 * impede pedir de novo depois dele passar).
 *
 * <p>Janela deslizante genérica, sem biblioteca externa - reusável por chave arbitrária
 * ({@code "codigo:" + ip}, {@code "login:" + ip}, etc.), cada chamador decide seu próprio limite e
 * janela. Guarda só timestamps recentes por chave (poda os expirados a cada chamada - memória por
 * chave é auto-limitada pela própria janela); em uma única instância de processo, não
 * compartilhado entre réplicas - suficiente pra a escala atual do sistema (PRD: até ~10 usuários),
 * mas viraria um limitador centralizado (Redis) se o backend algum dia rodar em mais de uma
 * réplica.
 */
@Component
public class LimitadorDeTaxa {

    private final Clock clock;
    private final Map<String, Deque<Instant>> historico = new ConcurrentHashMap<>();

    public LimitadorDeTaxa(Clock clock) {
        this.clock = clock;
    }

    /**
     * {@code true} se esta chamada é permitida (e já é contabilizada); {@code false} se {@code
     * chave} já bateu {@code limite} chamadas dentro de {@code janela} - a chamada recusada NÃO é
     * contabilizada (não pune mais ainda quem já foi bloqueado).
     */
    public boolean permitir(String chave, int limite, Duration janela) {
        Instant agora = Instant.now(clock);
        Instant corte = agora.minus(janela);
        Deque<Instant> eventos = historico.computeIfAbsent(chave, k -> new ConcurrentLinkedDeque<>());

        synchronized (eventos) {
            while (!eventos.isEmpty() && eventos.peekFirst().isBefore(corte)) {
                eventos.pollFirst();
            }
            if (eventos.size() >= limite) {
                return false;
            }
            eventos.addLast(agora);
            return true;
        }
    }
}
