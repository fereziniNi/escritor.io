package io.escritor.presenca.kanban.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CriadorProjetoPessoalTest {

    @Mock
    private ProjetoRepository projetoRepository;

    @Mock
    private ColunaRepository colunaRepository;

    @Mock
    private MembroProjetoRepository membroProjetoRepository;

    @Test
    void criaProjetoPessoalComTresColunasEMembroDoDono() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-27T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        Usuario dono = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
        when(projetoRepository.save(any(Projeto.class))).thenAnswer(i -> i.getArgument(0));
        CriadorProjetoPessoal criador =
                new CriadorProjetoPessoal(projetoRepository, colunaRepository, membroProjetoRepository, clock);

        Projeto criado = criador.criar(dono);

        assertThat(criado.isPessoal()).isTrue();
        assertThat(criado.getInicio()).isEqualTo(LocalDate.of(2026, 11, 27));
        ArgumentCaptor<Coluna> colunas = ArgumentCaptor.forClass(Coluna.class);
        verify(colunaRepository, times(3)).save(colunas.capture());
        assertThat(colunas.getAllValues()).extracting(Coluna::getNome).containsExactly("A fazer", "Em andamento", "Feito");
        assertThat(colunas.getAllValues()).extracting(Coluna::getOrdem).containsExactly(0, 1, 2);
        assertThat(colunas.getAllValues()).extracting(Coluna::getLimiteWip).containsOnlyNulls();
        ArgumentCaptor<MembroProjeto> membro = ArgumentCaptor.forClass(MembroProjeto.class);
        verify(membroProjetoRepository).save(membro.capture());
        assertThat(membro.getValue().getUsuario()).isSameAs(dono);
        assertThat(membro.getValue().getProjeto()).isSameAs(criado);
    }
}
