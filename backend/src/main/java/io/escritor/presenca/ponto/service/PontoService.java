package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SequenciaMarcacao;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.RegistroPontoResponse;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class PontoService {

    private final RegistroPontoRepository registroPontoRepository;
    private final Clock clock;

    public PontoService(RegistroPontoRepository registroPontoRepository, Clock clock) {
        this.registroPontoRepository = registroPontoRepository;
        this.clock = clock;
    }

    public RegistroPontoResponse marcar(Usuario usuario, TipoRegistroPonto tipo, String ip, String userAgent) {
        RegistroPonto ultimo =
                registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario).orElse(null);
        TipoRegistroPonto ultimoTipo = ultimo == null ? null : ultimo.getTipo();

        if (!SequenciaMarcacao.transicaoValida(ultimoTipo, tipo)) {
            throw new SequenciaInvalidaException(ultimoTipo, tipo);
        }

        String hashAnterior = ultimo == null ? null : ultimo.getHash();
        Instant momento = Instant.now(clock);

        RegistroPonto novo = new RegistroPonto(
                usuario, tipo, momento, OrigemRegistroPonto.WEB, ip, userAgent, hashAnterior);

        RegistroPonto salvo = registroPontoRepository.save(novo);

        return RegistroPontoResponse.de(salvo);
    }
}
