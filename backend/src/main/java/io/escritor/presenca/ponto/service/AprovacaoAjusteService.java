package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import io.escritor.presenca.ponto.web.SolicitacaoAjusteResponse;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aprovar nunca edita o {@code registroAlvo} original (registro_ponto é append-only, ver ADR do
 * PRD §3.2): sempre INSERE um {@link RegistroPonto} novo, encadeado no hash como qualquer outra
 * marcação, com {@code substitui} apontando pro original quando existe um. Rejeitar não cria
 * registro nenhum - é só a solicitação mudando de status.
 */
@Service
public class AprovacaoAjusteService {

    private final SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;
    private final RegistroPontoRepository registroPontoRepository;
    private final Clock clock;

    public AprovacaoAjusteService(
            SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository,
            RegistroPontoRepository registroPontoRepository,
            Clock clock) {
        this.solicitacaoAjustePontoRepository = solicitacaoAjustePontoRepository;
        this.registroPontoRepository = registroPontoRepository;
        this.clock = clock;
    }

    @Transactional
    public SolicitacaoAjusteResponse aprovar(Long solicitacaoId, Usuario avaliador, String parecer) {
        SolicitacaoAjustePonto solicitacao = buscarSolicitacao(solicitacaoId);
        solicitacao.aprovar(avaliador, Instant.now(clock), parecer);

        Usuario colaborador = solicitacao.getUsuario();
        RegistroPonto ultimo =
                registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(colaborador).orElse(null);
        String hashAnterior = ultimo == null ? null : ultimo.getHash();

        RegistroPonto correcao = new RegistroPonto(
                colaborador,
                solicitacao.getTipoSolicitado(),
                solicitacao.getMomentoSolicitado(),
                OrigemRegistroPonto.AJUSTE_APROVADO,
                null,
                null,
                hashAnterior,
                solicitacao.getRegistroAlvo());
        registroPontoRepository.save(correcao);

        SolicitacaoAjustePonto salva = solicitacaoAjustePontoRepository.save(solicitacao);
        return SolicitacaoAjusteResponse.de(salva);
    }

    @Transactional
    public SolicitacaoAjusteResponse rejeitar(Long solicitacaoId, Usuario avaliador, String parecer) {
        SolicitacaoAjustePonto solicitacao = buscarSolicitacao(solicitacaoId);
        solicitacao.rejeitar(avaliador, Instant.now(clock), parecer);

        SolicitacaoAjustePonto salva = solicitacaoAjustePontoRepository.save(solicitacao);
        return SolicitacaoAjusteResponse.de(salva);
    }

    private SolicitacaoAjustePonto buscarSolicitacao(Long id) {
        return solicitacaoAjustePontoRepository
                .findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Solicitação de ajuste não encontrada: " + id));
    }
}
