package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.NomeColunaObrigatorioException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.domain.Quadro;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.kanban.repository.QuadroRepository;
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
class ColunaServiceTest {

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private QuadroRepository quadroRepository;

    private final Quadro quadro = quadroComId(1L);

    private ColunaService service;

    private static Quadro quadroComId(Long id) {
        Quadro quadro = new Quadro("Backlog", null);
        ReflectionTestUtils.setField(quadro, "id", id);
        return quadro;
    }

    @BeforeEach
    void setUp() {
        service = new ColunaService(colunaRepository, quadroRepository);
    }

    @Test
    void criaColunaComOrdemLivre() {
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(colunaRepository.existsByQuadroAndOrdem(quadro, 0)).thenReturn(false);
        when(colunaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "A fazer", 0, null);

        assertThat(resposta.nome()).isEqualTo("A fazer");
        assertThat(resposta.ordem()).isZero();
        assertThat(resposta.quadroId()).isEqualTo(1L);
    }

    @Test
    void criarComOrdemJaUsadaLancaExcecaoSemSalvar() {
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(colunaRepository.existsByQuadroAndOrdem(quadro, 0)).thenReturn(true);

        assertThatThrownBy(() -> service.criar(1L, "A fazer", 0, null))
                .isInstanceOf(OrdemColunaDuplicadaException.class);

        verify(colunaRepository, never()).save(any());
    }

    @Test
    void criarEmQuadroInexistenteLancaRecursoNaoEncontrado() {
        when(quadroRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99L, "A fazer", 0, null))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void criarSemNomeLancaExcecaoSemSalvar() {
        when(quadroRepository.findById(1L)).thenReturn(Optional.of(quadro));
        when(colunaRepository.existsByQuadroAndOrdem(quadro, 0)).thenReturn(false);

        assertThatThrownBy(() -> service.criar(1L, "   ", 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);

        verify(colunaRepository, never()).save(any());
    }

    @Test
    void duasColunasDeQuadrosDiferentesPodemTerAMesmaOrdem() {
        Quadro outroQuadro = quadroComId(2L);
        when(quadroRepository.findById(2L)).thenReturn(Optional.of(outroQuadro));
        when(colunaRepository.existsByQuadroAndOrdem(outroQuadro, 0)).thenReturn(false);
        when(colunaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(2L, "A fazer", 0, null);

        assertThat(resposta.quadroId()).isEqualTo(2L);
    }
}
