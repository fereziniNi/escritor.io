package io.escritor.presenca.kanban.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.FiltroRelatorioInvalidoException;
import io.escritor.presenca.kanban.domain.SessaoTrabalho;
import io.escritor.presenca.kanban.repository.SessaoTrabalhoRepository;
import io.escritor.presenca.kanban.web.TotalApontadoResponse;
import io.escritor.presenca.kanban.web.TotalPorCardResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RelatorioTrabalhoServiceTest {

    private static final Instant INICIO_PERIODO = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant FIM_PERIODO = Instant.parse("2026-02-01T00:00:00Z");

    @Mock
    private SessaoTrabalhoRepository sessaoTrabalhoRepository;

    @Mock
    private VisibilidadeUsuarioService visibilidadeUsuarioService;

    @Mock
    private ProjetoRepository projetoRepository;

    private RelatorioTrabalhoService service;

    private Projeto projeto;
    private Coluna coluna;
    private Usuario usuario;

    private static Usuario usuarioComId(Long id) {
        Usuario u = new Usuario("Ana Souza", "ana" + id + "@escritor.io", Papel.COLABORADOR, 480);
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static Card cardComId(Coluna coluna, String titulo, Usuario criadoPor, Long id) {
        Card card = new Card(coluna, titulo, null, 1024.0, null, null, null, criadoPor);
        ReflectionTestUtils.setField(card, "id", id);
        return card;
    }

    @BeforeEach
    void setUp() {
        service = new RelatorioTrabalhoService(sessaoTrabalhoRepository, visibilidadeUsuarioService, projetoRepository);
        usuario = usuarioComId(1L);
        projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
        ReflectionTestUtils.setField(projeto, "id", 5L);
        coluna = new Coluna(projeto, "A fazer", 0, null);
    }

    @Test
    void listarTotalPorCardSomaAsSessoesFechadasAgrupandoPorCard() {
        Card card1 = cardComId(coluna, "Corrigir bug", usuario, 10L);
        Card card2 = cardComId(coluna, "Escrever teste", usuario, 20L);
        SessaoTrabalho sessao1 = new SessaoTrabalho(card1, usuario, Instant.parse("2026-01-10T09:00:00Z"));
        sessao1.pausar(Instant.parse("2026-01-10T09:30:00Z"));
        SessaoTrabalho sessao2 = new SessaoTrabalho(card1, usuario, Instant.parse("2026-01-11T09:00:00Z"));
        sessao2.pausar(Instant.parse("2026-01-11T09:15:00Z"));
        SessaoTrabalho sessao3 = new SessaoTrabalho(card2, usuario, Instant.parse("2026-01-12T09:00:00Z"));
        sessao3.pausar(Instant.parse("2026-01-12T10:00:00Z"));

        when(visibilidadeUsuarioService.resolverAlvo(isNull(), eq(usuario), any())).thenReturn(usuario);
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, INICIO_PERIODO, FIM_PERIODO))
                .thenReturn(List.of(sessao1, sessao2, sessao3));

        List<TotalPorCardResponse> resultado = service.listarTotalPorCard(null, INICIO_PERIODO, FIM_PERIODO, usuario);

        assertThat(resultado).hasSize(2);
        assertThat(resultado.get(0).cardId()).isEqualTo(20L);
        assertThat(resultado.get(0).totalMinutos()).isEqualTo(60);
        assertThat(resultado.get(1).cardId()).isEqualTo(10L);
        assertThat(resultado.get(1).cardTitulo()).isEqualTo("Corrigir bug");
        assertThat(resultado.get(1).totalMinutos()).isEqualTo(45);
    }

    @Test
    void listarTotalPorCardSemSessoesNoPeriodoRetornaListaVazia() {
        when(visibilidadeUsuarioService.resolverAlvo(isNull(), eq(usuario), any())).thenReturn(usuario);
        when(sessaoTrabalhoRepository.findByUsuarioAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(usuario, INICIO_PERIODO, FIM_PERIODO))
                .thenReturn(List.of());

        List<TotalPorCardResponse> resultado = service.listarTotalPorCard(null, INICIO_PERIODO, FIM_PERIODO, usuario);

        assertThat(resultado).isEmpty();
    }

    @Test
    void listarTotalPorCardSemAcessoAoUsuarioFiltradoPropagaAExcecaoDeAcessoNegado() {
        Usuario colaborador = usuarioComId(1L);
        when(visibilidadeUsuarioService.resolverAlvo(eq(2L), eq(colaborador), any()))
                .thenThrow(new AcessoNegadoException("Sem acesso aos dados desse usuário"));

        assertThatThrownBy(() -> service.listarTotalPorCard(2L, INICIO_PERIODO, FIM_PERIODO, colaborador))
                .isInstanceOf(AcessoNegadoException.class);
    }

    @Test
    void totalApontadoPorProjetoSomaTodasAsSessoesFechadasDoProjeto() {
        when(projetoRepository.findById(5L)).thenReturn(Optional.of(projeto));
        Card card = cardComId(coluna, "Corrigir bug", usuario, 10L);
        SessaoTrabalho sessao1 = new SessaoTrabalho(card, usuario, Instant.parse("2026-01-10T09:00:00Z"));
        sessao1.pausar(Instant.parse("2026-01-10T09:30:00Z"));
        SessaoTrabalho sessao2 = new SessaoTrabalho(card, usuarioComId(2L), Instant.parse("2026-01-11T09:00:00Z"));
        sessao2.pausar(Instant.parse("2026-01-11T09:20:00Z"));
        when(sessaoTrabalhoRepository.findByCard_Coluna_ProjetoAndFimIsNotNullAndInicioGreaterThanEqualAndInicioLessThan(
                        projeto, INICIO_PERIODO, FIM_PERIODO))
                .thenReturn(List.of(sessao1, sessao2));

        TotalApontadoResponse resultado = service.totalApontadoPorProjeto(5L, INICIO_PERIODO, FIM_PERIODO);

        assertThat(resultado.totalMinutos()).isEqualTo(50);
    }

    @Test
    void totalApontadoPorProjetoSemProjetoIdLancaFiltroInvalido() {
        assertThatThrownBy(() -> service.totalApontadoPorProjeto(null, INICIO_PERIODO, FIM_PERIODO))
                .isInstanceOf(FiltroRelatorioInvalidoException.class);
    }

    @Test
    void totalApontadoPorProjetoInexistenteLancaRecursoNaoEncontrado() {
        when(projetoRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.totalApontadoPorProjeto(999L, INICIO_PERIODO, FIM_PERIODO))
                .isInstanceOf(RecursoNaoEncontradoException.class);
    }
}
