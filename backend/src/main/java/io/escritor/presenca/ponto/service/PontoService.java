package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SequenciaMarcacao;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.notificacao.NotificacaoPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.web.EstadoAtualPontoResponse;
import io.escritor.presenca.ponto.web.RegistroPontoResponse;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class PontoService {

    private final RegistroPontoRepository registroPontoRepository;
    private final JornadaService jornadaService;
    private final Clock clock;
    private final NotificacaoPonto notificacaoPonto;

    public PontoService(
            RegistroPontoRepository registroPontoRepository,
            JornadaService jornadaService,
            Clock clock,
            NotificacaoPonto notificacaoPonto) {
        this.registroPontoRepository = registroPontoRepository;
        this.jornadaService = jornadaService;
        this.clock = clock;
        this.notificacaoPonto = notificacaoPonto;
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

        // Pedido do cliente: "sempre que algum funcionario iniciasse o trabalho ou terminasse
        // enviar uma mensagem para o chefe avisando" - best-effort, assíncrono (ver
        // `NotificacaoPontoWhatsApp`), nunca pode fazer este método falhar: o ponto já foi salvo
        // na linha acima, o aviso é só um efeito colateral.
        notificacaoPonto.avisarPonto(usuario, tipo, momento);

        return RegistroPontoResponse.de(salvo);
    }

    public EstadoAtualPontoResponse estadoAtual(Usuario usuario) {
        RegistroPonto ultimo =
                registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(usuario).orElse(null);
        TipoRegistroPonto ultimoTipo = ultimo == null ? null : ultimo.getTipo();
        Instant ultimoMomento = ultimo == null ? null : ultimo.getMomento();
        long segundosTrabalhadosAteAgora = jornadaService.segundosTrabalhadosAteAgora(usuario);

        return new EstadoAtualPontoResponse(
                ultimoTipo, ultimoMomento, segundosTrabalhadosAteAgora, SequenciaMarcacao.tiposValidosApos(ultimoTipo));
    }
}
