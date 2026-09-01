package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.web.CriarProjetoRequest;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjetoServiceTest {

    @Mock
    private ProjetoRepository projetoRepository;

    private ProjetoService projetoService;

    @BeforeEach
    void setUp() {
        projetoService = new ProjetoService(projetoRepository);
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
}
