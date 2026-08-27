package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.ParecerObrigatorioException;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.SolicitacaoAjustePonto;
import io.escritor.presenca.ponto.domain.SolicitacaoJaAvaliadaException;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AprovacaoAjusteServiceTest {

    @Mock
    private SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    private final Usuario colaborador = usuarioComId(1L);
    private final Usuario gestor = usuarioComId(2L);
    private final Instant agora = Instant.parse("2026-01-16T10:00:00Z");
    private final Clock clock = Clock.fixed(agora, ZoneOffset.UTC);

    private AprovacaoAjusteService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    private SolicitacaoAjustePonto solicitacaoComId(Long id, RegistroPonto registroAlvo) {
        SolicitacaoAjustePonto solicitacao = new SolicitacaoAjustePonto(
                colaborador, registroAlvo, TipoRegistroPonto.ENTRADA, Instant.parse("2026-01-15T09:00:00Z"), "Esqueci");
        ReflectionTestUtils.setField(solicitacao, "id", id);
        return solicitacao;
    }

    @BeforeEach
    void setUp() {
        service = new AprovacaoAjusteService(solicitacaoAjustePontoRepository, registroPontoRepository, clock);
    }

    @Test
    void aprovarMarcacaoEsquecidaCriaRegistroSemSubstituirNada() {
        SolicitacaoAjustePonto solicitacao = solicitacaoComId(1L, null);
        when(solicitacaoAjustePontoRepository.findById(1L)).thenReturn(Optional.of(solicitacao));
        when(solicitacaoAjustePontoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(colaborador)).thenReturn(Optional.empty());

        service.aprovar(1L, gestor, "Confirmado");

        ArgumentCaptor<RegistroPonto> captor = ArgumentCaptor.forClass(RegistroPonto.class);
        verify(registroPontoRepository).save(captor.capture());
        RegistroPonto criado = captor.getValue();
        assertThat(criado.getSubstitui()).isNull();
        assertThat(criado.getOrigem()).isEqualTo(OrigemRegistroPonto.AJUSTE_APROVADO);
        assertThat(criado.getHashAnterior()).isNull();
        assertThat(criado.getTipo()).isEqualTo(TipoRegistroPonto.ENTRADA);
        assertThat(criado.getMomento()).isEqualTo(Instant.parse("2026-01-15T09:00:00Z"));

        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.APROVADA);
        assertThat(solicitacao.getAvaliadoEm()).isEqualTo(agora);
    }

    @Test
    void aprovarCorrecaoDeRegistroExistenteApontaSubstituiParaOAlvo() {
        RegistroPonto alvo = new RegistroPonto(
                colaborador,
                TipoRegistroPonto.ENTRADA,
                Instant.parse("2026-01-15T09:15:00Z"),
                OrigemRegistroPonto.WEB,
                "127.0.0.1",
                "junit",
                null);
        SolicitacaoAjustePonto solicitacao = solicitacaoComId(2L, alvo);
        when(solicitacaoAjustePontoRepository.findById(2L)).thenReturn(Optional.of(solicitacao));
        when(solicitacaoAjustePontoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));
        when(registroPontoRepository.findFirstByUsuarioOrderByCriadoEmDesc(colaborador)).thenReturn(Optional.of(alvo));

        service.aprovar(2L, gestor, null);

        ArgumentCaptor<RegistroPonto> captor = ArgumentCaptor.forClass(RegistroPonto.class);
        verify(registroPontoRepository).save(captor.capture());
        RegistroPonto criado = captor.getValue();
        assertThat(criado.getSubstitui()).isSameAs(alvo);
        assertThat(criado.getHashAnterior()).isEqualTo(alvo.getHash());
    }

    @Test
    void aprovarSolicitacaoJaAvaliadaNaoCriaRegistro() {
        SolicitacaoAjustePonto solicitacao = solicitacaoComId(3L, null);
        solicitacao.aprovar(gestor, agora.minusSeconds(3600), null);
        when(solicitacaoAjustePontoRepository.findById(3L)).thenReturn(Optional.of(solicitacao));

        assertThatThrownBy(() -> service.aprovar(3L, gestor, null)).isInstanceOf(SolicitacaoJaAvaliadaException.class);

        verify(registroPontoRepository, never()).save(any());
    }

    @Test
    void aprovarSolicitacaoInexistenteLancaRecursoNaoEncontrado() {
        when(solicitacaoAjustePontoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.aprovar(99L, gestor, null)).isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void rejeitarNaoCriaRegistroPonto() {
        SolicitacaoAjustePonto solicitacao = solicitacaoComId(4L, null);
        when(solicitacaoAjustePontoRepository.findById(4L)).thenReturn(Optional.of(solicitacao));
        when(solicitacaoAjustePontoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        service.rejeitar(4L, gestor, "Sem evidência do horário alegado");

        verify(registroPontoRepository, never()).save(any());
        assertThat(solicitacao.getStatus()).isEqualTo(StatusSolicitacaoAjuste.REJEITADA);
        assertThat(solicitacao.getParecer()).isEqualTo("Sem evidência do horário alegado");
    }

    @Test
    void rejeitarSemParecerLancaExcecao() {
        SolicitacaoAjustePonto solicitacao = solicitacaoComId(5L, null);
        when(solicitacaoAjustePontoRepository.findById(5L)).thenReturn(Optional.of(solicitacao));

        assertThatThrownBy(() -> service.rejeitar(5L, gestor, "   ")).isInstanceOf(ParecerObrigatorioException.class);
    }
}
