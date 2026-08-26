package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoEquipeRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import io.escritor.presenca.identidade.web.VincularEquipeRequest;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjetoServiceTest {

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private EquipeRepository equipeRepository;

    @Mock
    private ProjetoEquipeRepository projetoEquipeRepository;

    private ProjetoService projetoService;

    @BeforeEach
    void setUp() {
        projetoService = new ProjetoService(projetoRepository, equipeRepository, projetoEquipeRepository);
    }

    @Test
    void criaProjeto() {
        when(projetoRepository.save(any(Projeto.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = projetoService.criar(
                new CriarProjetoRequest("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null));

        assertThat(resposta.nome()).isEqualTo("Portal");
        assertThat(resposta.cliente()).isEqualTo("Acme");
        assertThat(resposta.status()).isEqualTo(StatusProjeto.ATIVO);
    }

    @Test
    void vincularEquipeNovaInsereVinculo() {
        Projeto projeto = comId(new Projeto("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null), 1L);
        Equipe equipe = comId(new Equipe("Backend", null), 2L);
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(equipeRepository.findById(2L)).thenReturn(Optional.of(equipe));
        when(projetoEquipeRepository.existsByProjetoAndEquipe(projeto, equipe)).thenReturn(false);

        projetoService.vincularEquipe(1L, new VincularEquipeRequest(2L));

        verify(projetoEquipeRepository).save(any());
    }

    @Test
    void vincularEquipeJaVinculadaEIdempotenteNaoDuplicaLinha() {
        Projeto projeto = comId(new Projeto("Portal", "Acme", StatusProjeto.ATIVO, LocalDate.of(2026, 1, 1), null), 1L);
        Equipe equipe = comId(new Equipe("Backend", null), 2L);
        when(projetoRepository.findById(1L)).thenReturn(Optional.of(projeto));
        when(equipeRepository.findById(2L)).thenReturn(Optional.of(equipe));
        when(projetoEquipeRepository.existsByProjetoAndEquipe(projeto, equipe)).thenReturn(true);

        projetoService.vincularEquipe(1L, new VincularEquipeRequest(2L));

        verify(projetoEquipeRepository, never()).save(any());
    }

    private static <T> T comId(T entidade, Long id) {
        ReflectionTestUtils.setField(entidade, "id", id);
        return entidade;
    }
}
