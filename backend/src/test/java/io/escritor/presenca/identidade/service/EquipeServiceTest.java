package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.PapelNaEquipe;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.EquipeRepository;
import io.escritor.presenca.identidade.repository.MembroEquipeRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.web.AdicionarMembroRequest;
import io.escritor.presenca.identidade.web.CriarEquipeRequest;
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
class EquipeServiceTest {

    @Mock
    private EquipeRepository equipeRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private MembroEquipeRepository membroEquipeRepository;

    private EquipeService equipeService;

    @BeforeEach
    void setUp() {
        equipeService = new EquipeService(equipeRepository, usuarioRepository, membroEquipeRepository);
    }

    @Test
    void criaEquipe() {
        when(equipeRepository.save(any(Equipe.class))).thenAnswer(chamada -> chamada.getArgument(0));

        var resposta = equipeService.criar(new CriarEquipeRequest("Backend", "Time de backend"));

        assertThat(resposta.nome()).isEqualTo("Backend");
        assertThat(resposta.descricao()).isEqualTo("Time de backend");
        assertThat(resposta.ativa()).isTrue();
    }

    @Test
    void adicionarMembroNovoInsereVinculo() {
        Equipe equipe = comId(new Equipe("Backend", null), 1L);
        Usuario usuario = comId(new Usuario("Ana", "ana@escritor.io", Papel.COLABORADOR, 360), 2L);
        when(equipeRepository.findById(1L)).thenReturn(Optional.of(equipe));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(usuario));
        when(membroEquipeRepository.existsByEquipeAndUsuario(equipe, usuario)).thenReturn(false);

        equipeService.adicionarMembro(1L, new AdicionarMembroRequest(2L, PapelNaEquipe.MEMBRO));

        verify(membroEquipeRepository).save(any());
    }

    @Test
    void adicionarMembroJaExistenteEIdempotenteNaoDuplicaLinha() {
        Equipe equipe = comId(new Equipe("Backend", null), 1L);
        Usuario usuario = comId(new Usuario("Ana", "ana@escritor.io", Papel.COLABORADOR, 360), 2L);
        when(equipeRepository.findById(1L)).thenReturn(Optional.of(equipe));
        when(usuarioRepository.findById(2L)).thenReturn(Optional.of(usuario));
        when(membroEquipeRepository.existsByEquipeAndUsuario(equipe, usuario)).thenReturn(true);

        equipeService.adicionarMembro(1L, new AdicionarMembroRequest(2L, PapelNaEquipe.MEMBRO));

        verify(membroEquipeRepository, never()).save(any());
    }

    private static <T> T comId(T entidade, Long id) {
        ReflectionTestUtils.setField(entidade, "id", id);
        return entidade;
    }
}
