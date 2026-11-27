package io.escritor.presenca.kanban.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ProjetoPessoalServiceTest {

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private CriadorProjetoPessoal criador;

    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Projeto pessoal = Projeto.pessoalDe(usuario, LocalDate.now());

    @Test
    void reaproveitaProjetoExistenteSemCriar() {
        when(projetoRepository.findByPessoalDe(usuario)).thenReturn(Optional.of(pessoal));

        assertThat(new ProjetoPessoalService(projetoRepository, criador).obterOuCriar(usuario)).isSameAs(pessoal);
        verify(criador, never()).criar(any());
    }

    @Test
    void criaQuandoNaoExiste() {
        when(projetoRepository.findByPessoalDe(usuario)).thenReturn(Optional.empty());
        when(criador.criar(usuario)).thenReturn(pessoal);

        assertThat(new ProjetoPessoalService(projetoRepository, criador).obterOuCriar(usuario)).isSameAs(pessoal);
    }

    @Test
    void emCorridaReleOExistenteAposViolacaoDeUnicidade() {
        when(projetoRepository.findByPessoalDe(usuario)).thenReturn(Optional.empty()).thenReturn(Optional.of(pessoal));
        when(criador.criar(usuario)).thenThrow(new DataIntegrityViolationException("uk"));

        assertThat(new ProjetoPessoalService(projetoRepository, criador).obterOuCriar(usuario)).isSameAs(pessoal);
        verify(projetoRepository, times(2)).findByPessoalDe(usuario);
    }
}
