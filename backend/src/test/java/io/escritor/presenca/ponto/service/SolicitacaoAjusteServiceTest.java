package io.escritor.presenca.ponto.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.ponto.domain.JustificativaObrigatoriaException;
import io.escritor.presenca.ponto.domain.OrigemRegistroPonto;
import io.escritor.presenca.ponto.domain.RegistroPonto;
import io.escritor.presenca.ponto.domain.StatusSolicitacaoAjuste;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import io.escritor.presenca.ponto.repository.RegistroPontoRepository;
import io.escritor.presenca.ponto.repository.SolicitacaoAjustePontoRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
class SolicitacaoAjusteServiceTest {

    @Mock
    private SolicitacaoAjustePontoRepository solicitacaoAjustePontoRepository;

    @Mock
    private RegistroPontoRepository registroPontoRepository;

    private final Usuario usuario = usuarioComId(1L);
    private final Usuario outroUsuario = usuarioComId(2L);
    private final Instant momento = Instant.parse("2026-01-15T09:00:00Z");

    private SolicitacaoAjusteService service;

    private static Usuario usuarioComId(Long id) {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }

    @BeforeEach
    void setUp() {
        service = new SolicitacaoAjusteService(solicitacaoAjustePontoRepository, registroPontoRepository);
    }

    @Test
    void solicitaMarcacaoEsquecidaSemRegistroAlvo() {
        when(solicitacaoAjustePontoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.solicitar(usuario, TipoRegistroPonto.ENTRADA, momento, null, "Esqueci de bater o ponto");

        assertThat(resposta.status()).isEqualTo(StatusSolicitacaoAjuste.PENDENTE);
        assertThat(resposta.registroAlvoId()).isNull();
        verify(registroPontoRepository, never()).findById(any());
    }

    @Test
    void solicitaCorrecaoDeRegistroProprioExistente() {
        RegistroPonto alvo = new RegistroPonto(
                usuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
        ReflectionTestUtils.setField(alvo, "id", 10L);
        when(registroPontoRepository.findById(10L)).thenReturn(Optional.of(alvo));
        when(solicitacaoAjustePontoRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.solicitar(usuario, TipoRegistroPonto.ENTRADA, momento, 10L, "Bati errado, era 9h10");

        assertThat(resposta.registroAlvoId()).isEqualTo(10L);
    }

    @Test
    void registroAlvoDeOutroUsuarioNaoEhEncontrado() {
        RegistroPonto alvoDeOutraPessoa = new RegistroPonto(
                outroUsuario, TipoRegistroPonto.ENTRADA, momento, OrigemRegistroPonto.WEB, "127.0.0.1", "junit", null);
        ReflectionTestUtils.setField(alvoDeOutraPessoa, "id", 10L);
        when(registroPontoRepository.findById(10L)).thenReturn(Optional.of(alvoDeOutraPessoa));

        assertThatThrownBy(() -> service.solicitar(usuario, TipoRegistroPonto.ENTRADA, momento, 10L, "Justificativa"))
                .isInstanceOf(RecursoNaoEncontradoException.class);

        verify(solicitacaoAjustePontoRepository, never()).save(any());
    }

    @Test
    void registroAlvoInexistenteLancaRecursoNaoEncontrado() {
        when(registroPontoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.solicitar(usuario, TipoRegistroPonto.ENTRADA, momento, 99L, "Justificativa"))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void justificativaEmBrancoLancaExcecaoSemSalvar() {
        assertThatThrownBy(() -> service.solicitar(usuario, TipoRegistroPonto.ENTRADA, momento, null, "   "))
                .isInstanceOf(JustificativaObrigatoriaException.class);

        verify(solicitacaoAjustePontoRepository, never()).save(any());
    }
}
