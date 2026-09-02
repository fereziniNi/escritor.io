package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.NomeColunaObrigatorioException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import java.time.LocalDate;
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
    private ProjetoRepository projetoRepository;

    private final Projeto projeto = projetoComId(1L);

    private ColunaService service;

    private static Projeto projetoComId(Long id) {
        Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", id);
        return projeto;
    }

    @BeforeEach
    void setUp() {
        service = new ColunaService(colunaRepository, projetoRepository);
    }

    @Test
    void criaColunaComOrdemLivre() {
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(colunaRepository.existsByProjetoAndOrdem(projeto, 0)).thenReturn(false);
        when(colunaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(1L, "A fazer", 0, null);

        assertThat(resposta.nome()).isEqualTo("A fazer");
        assertThat(resposta.ordem()).isZero();
        assertThat(resposta.projetoId()).isEqualTo(1L);
    }

    @Test
    void criarComOrdemJaUsadaLancaExcecaoSemSalvar() {
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(colunaRepository.existsByProjetoAndOrdem(projeto, 0)).thenReturn(true);

        assertThatThrownBy(() -> service.criar(1L, "A fazer", 0, null))
                .isInstanceOf(OrdemColunaDuplicadaException.class);

        verify(colunaRepository, never()).save(any());
    }

    @Test
    void criarEmProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.criar(99L, "A fazer", 0, null))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }

    @Test
    void criarSemNomeLancaExcecaoSemSalvar() {
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(colunaRepository.existsByProjetoAndOrdem(projeto, 0)).thenReturn(false);

        assertThatThrownBy(() -> service.criar(1L, "   ", 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);

        verify(colunaRepository, never()).save(any());
    }

    @Test
    void duasColunasDeProjetosDiferentesPodemTerAMesmaOrdem() {
        Projeto outroProjeto = projetoComId(2L);
        when(projetoRepository.findById(2L)).thenReturn(Optional.of(outroProjeto));
        when(colunaRepository.existsByProjetoAndOrdem(outroProjeto, 0)).thenReturn(false);
        when(colunaRepository.save(any())).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = service.criar(2L, "A fazer", 0, null);

        assertThat(resposta.projetoId()).isEqualTo(2L);
    }
}
