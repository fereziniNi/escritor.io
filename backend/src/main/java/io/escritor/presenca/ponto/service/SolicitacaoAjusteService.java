package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import io.escritor.presenca.ponto.web.SolicitacaoAjusteResponse;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class SolicitacaoAjusteService {

    private final SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;
    private final RegistroPontoRepository registroPontoRepository;

    public SolicitacaoAjusteService(
            SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository,
            RegistroPontoRepository registroPontoRepository) {
        this.solicitacaoAjustePontoRepository = solicitacaoAjustePontoRepository;
        this.registroPontoRepository = registroPontoRepository;
    }

    public SolicitacaoAjusteResponse solicitar(
            Usuario usuario, TipoRegistroPonto tipo, Instant momento, Long registroAlvoId, String justificativa) {
        RegistroPonto registroAlvo = registroAlvoId == null ? null : buscarRegistroAlvoDoUsuario(usuario, registroAlvoId);

        SolicitacaoAjustePonto nova = new SolicitacaoAjustePonto(usuario, registroAlvo, tipo, momento, justificativa);
        SolicitacaoAjustePonto salva = solicitacaoAjustePontoRepository.save(nova);

        return SolicitacaoAjusteResponse.de(salva);
    }

    /**
     * Um colaborador só pode referenciar um registro seu como alvo - 404 (não 403) tanto pra um
     * id inexistente quanto pra um id de outra pessoa, pra não revelar que o registro existe.
     */
    private RegistroPonto buscarRegistroAlvoDoUsuario(Usuario usuario, Long registroAlvoId) {
        return registroPontoRepository
                .findById(registroAlvoId)
                .filter(registro -> registro.getUsuario().getId().equals(usuario.getId()))
                .orElseThrow(() -> new RecursoNaoEncontradoException("Registro de ponto não encontrado: " + registroAlvoId));
    }
}
