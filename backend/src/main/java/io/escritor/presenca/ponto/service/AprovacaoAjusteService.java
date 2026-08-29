package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import io.escritor.presenca.ponto.web.SolicitacaoAjusteResponse;
import io.escritor.presenca.ponto.web.SolicitacaoAjusteResumoResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
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
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;
    private final Clock clock;

    public AprovacaoAjusteService(
            SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository,
            RegistroPontoRepository registroPontoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService,
            Clock clock) {
        this.solicitacaoAjustePontoRepository = solicitacaoAjustePontoRepository;
        this.registroPontoRepository = registroPontoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
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

    /**
     * PRD §2: "gestor vê jornada e relatórios das suas equipes" - antes de S5.6, qualquer gestor
     * via/aprovava ajuste de qualquer equipe, lacuna que já existia desde S2.12. Reusa
     * {@link VisibilidadeUsuarioService#podeVer} (S5.1): como este método já trata `ADMIN` como
     * "vê todo mundo" e `requisitante == alvo` como sempre visível, filtrar com ele cobre os três
     * papéis que chegam aqui (endpoint já restrito a gestor/admin via `@PreAuthorize`) sem
     * precisar de um `if` de papel separado.
     */
    public List<SolicitacaoAjusteResumoResponse> listarPendentes(Usuario avaliador) {
        return solicitacaoAjustePontoRepository.findByStatusOrderByCriadoEmAsc(StatusSolicitacaoAjuste.PENDENTE).stream()
                .filter(solicitacao -> visibilidadeUsuarioService.podeVer(avaliador, solicitacao.getUsuario()))
                .map(SolicitacaoAjusteResumoResponse::de)
                .toList();
    }

    private SolicitacaoAjustePonto buscarSolicitacao(Long id) {
        return solicitacaoAjustePontoRepository
                .findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Solicitação de ajuste não encontrada: " + id));
    }
}
