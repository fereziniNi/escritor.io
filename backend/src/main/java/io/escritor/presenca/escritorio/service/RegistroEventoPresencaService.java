package io.escritor.presenca.escritorio.service;

import io.escritor.presenca.escritorio.domain.EventoPresenca;
import io.escritor.presenca.escritorio.domain.Zona;
import io.escritor.presenca.escritorio.repository.EventoPresencaRepository;
import io.escritor.presenca.escritorio.repository.ZonaRepository;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import java.time.Instant;
import org.springframework.stereotype.Service;

/**
 * PRD §3.5 (S6.12): grava {@link EventoPresenca} pra relatório futuro de salas - chamado por
 * {@code PresencaWebSocketHandler} sempre *depois* do broadcast de posição/status pros clientes
 * conectados, nunca antes, pra essa escrita nunca atrasar a resposta em tempo real (PRD).
 */
@Service
public class RegistroEventoPresencaService {

    private final EventoPresencaRepository eventoPresencaRepository;
    private final UsuarioRepository usuarioRepository;
    private final ZonaRepository zonaRepository;

    public RegistroEventoPresencaService(
            EventoPresencaRepository eventoPresencaRepository, UsuarioRepository usuarioRepository, ZonaRepository zonaRepository) {
        this.eventoPresencaRepository = eventoPresencaRepository;
        this.usuarioRepository = usuarioRepository;
        this.zonaRepository = zonaRepository;
    }

    /**
     * {@code zonaAnteriorId} nulo pula o encerramento (usuário não estava em nenhuma zona antes);
     * {@code zonaNovaId} nulo pula a abertura (usuário saiu pro espaço aberto, sem entrar em outra
     * zona). Os dois podem ser não-nulos numa única chamada (andar direto de uma zona pra outra).
     */
    public void registrarTransicaoDeZona(Long usuarioId, Long zonaAnteriorId, Long zonaNovaId, Instant agora) {
        if (zonaAnteriorId != null) {
            eventoPresencaRepository.findFirstByUsuarioIdAndZonaIdAndSaiuEmIsNull(usuarioId, zonaAnteriorId).ifPresent(evento -> {
                evento.encerrar(agora);
                eventoPresencaRepository.save(evento);
            });
        }

        if (zonaNovaId != null) {
            Usuario usuario =
                    usuarioRepository.findById(usuarioId).orElseThrow(() -> new RecursoNaoEncontradoException("Usuário não encontrado: " + usuarioId));
            Zona zona = zonaRepository.findById(zonaNovaId).orElseThrow(() -> new RecursoNaoEncontradoException("Zona não encontrada: " + zonaNovaId));
            eventoPresencaRepository.save(new EventoPresenca(usuario, zona, agora));
        }
    }
}
