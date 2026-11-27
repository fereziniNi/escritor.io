package io.escritor.presenca.kanban.web;

import io.escritor.presenca.identidade.domain.MembroProjeto;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.MembroProjetoRepository;
import io.escritor.presenca.identidade.repository.ProjetoRepository;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.repository.CardRepository;
import io.escritor.presenca.kanban.repository.ColunaRepository;
import io.escritor.presenca.seguranca.JwtService;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Ponta a ponta (HTTP real + Postgres real) da troca de estado em "Minhas tarefas", com os
 * quadros REAIS de produção: faltava um teste assim, só havia testes com mocks. */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TarefaEstadoEndToEndIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16").withInitScript("db-init/criar-papel-app.sql");

    @LocalServerPort
    private int port;

    @Autowired private JwtService jwtService;
    @Autowired private UsuarioRepository usuarioRepository;
    @Autowired private ProjetoRepository projetoRepository;
    @Autowired private MembroProjetoRepository membroProjetoRepository;
    @Autowired private ColunaRepository colunaRepository;
    @Autowired private CardRepository cardRepository;

    private RestTestClient client() {
        return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    private Usuario novoUsuario(String email) {
        return usuarioRepository.save(new Usuario("Nícolas", email, Papel.COLABORADOR, 360));
    }

    private Projeto projetoComMembro(String nome, Usuario membro) {
        Projeto p = projetoRepository.save(new Projeto(nome, nome, StatusProjeto.ATIVO, LocalDate.now(), null));
        membroProjetoRepository.save(new MembroProjeto(p, membro));
        return p;
    }

    private Coluna coluna(Projeto p, String nome, int ordem) {
        return colunaRepository.save(new Coluna(p, nome, ordem, null));
    }

    private Card card(Coluna c, Usuario resp, String titulo) {
        return cardRepository.save(new Card(c, titulo, null, 1024, resp, null, null, resp));
    }

    private void patchEstado(Usuario u, Long cardId, String estado, int statusEsperado) {
        String token = jwtService.gerarAccessToken(u.getId(), u.getPapel());
        client().patch()
                .uri("/tarefas/" + cardId + "/estado")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"estado\":\"" + estado + "\"}")
                .exchange()
                .expectStatus().isEqualTo(statusEsperado);
    }

    @Test
    void beyondComiteBacklogParaEmAndamentoMoveParaFazendo() {
        Usuario nicolas = novoUsuario("e2e-beyond@escritor.io");
        Projeto p = projetoComMembro("Beyond Comitê", nicolas);
        Coluna fazendo = coluna(p, "Fazendo", 1);
        coluna(p, "Feito", 2);
        Coluna backlog = coluna(p, "Backlog", 3);
        Card c = card(backlog, nicolas, "Correções erros apontados pt3");

        patchEstado(nicolas, c.getId(), "EM_ANDAMENTO", 200);

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getColuna().getId())
                .isEqualTo(fazendo.getId());
    }

    @Test
    void cambiaAFazerParaFeitoMoveParaFeito() {
        Usuario nicolas = novoUsuario("e2e-cambia@escritor.io");
        Projeto p = projetoComMembro("CambIA", nicolas);
        Coluna aFazer = coluna(p, "A fazer", 0);
        Coluna feito = coluna(p, "Feito", 1);
        coluna(p, "Backlog", 2);
        Card c = card(aFazer, nicolas, "Corrigir eventuais erros");

        patchEstado(nicolas, c.getId(), "FEITO", 200);

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getColuna().getId())
                .isEqualTo(feito.getId());
    }

    @Test
    void npsBacklogParaFeito() {
        Usuario nicolas = novoUsuario("e2e-nps@escritor.io");
        Projeto p = projetoComMembro("NPS - Chamadas por IA", nicolas);
        coluna(p, "A fazer", 0);
        coluna(p, "Fazendo", 1);
        Coluna feito = coluna(p, "Feito", 2);
        Coluna backlog = coluna(p, "Backlog", 3);
        Card c = card(backlog, nicolas, "Colocar em produção");

        patchEstado(nicolas, c.getId(), "FEITO", 200);

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getColuna().getId())
                .isEqualTo(feito.getId());
    }

    private org.springframework.test.web.servlet.client.RestTestClient.ResponseSpec chamar(
            Usuario u, String metodo, String uri, String corpo) {
        String token = jwtService.gerarAccessToken(u.getId(), u.getPapel());
        var req = client().method(org.springframework.http.HttpMethod.valueOf(metodo))
                .uri(uri)
                .header("Authorization", "Bearer " + token);
        if (corpo != null) {
            req.contentType(MediaType.APPLICATION_JSON).body(corpo);
        }
        return req.exchange();
    }

    // ---- Responsável pode agir no card mesmo sem ser membro do projeto ----

    @Test
    void responsavelForaDoProjetoMudaOEstadoDaPropriaTarefa() {
        Usuario membro = novoUsuario("e2e-resp-membro@escritor.io");
        Usuario responsavel = novoUsuario("e2e-resp-fora@escritor.io");
        Projeto p = projetoComMembro("Projeto Alheio", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);
        Coluna feito = coluna(p, "Feito", 1);
        Card c = card(aFazer, responsavel, "Direcionada pra mim");

        patchEstado(responsavel, c.getId(), "FEITO", 200);

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getColuna().getId())
                .isEqualTo(feito.getId());
    }

    @Test
    void naoMembroQueNaoEResponsavelNaoMudaOEstadoENadaMove() {
        Usuario membro = novoUsuario("e2e-nr-membro@escritor.io");
        Usuario responsavel = novoUsuario("e2e-nr-resp@escritor.io");
        Usuario intruso = novoUsuario("e2e-nr-intruso@escritor.io");
        Projeto p = projetoComMembro("Projeto Fechado", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);
        coluna(p, "Feito", 1);
        Card c = card(aFazer, responsavel, "Não é sua");

        patchEstado(intruso, c.getId(), "FEITO", 404);

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getColuna().getId())
                .isEqualTo(aFazer.getId());
    }

    @Test
    void responsavelForaDoProjetoIniciaEFinalizaOCronometro() {
        Usuario membro = novoUsuario("e2e-cron-membro@escritor.io");
        Usuario responsavel = novoUsuario("e2e-cron-resp@escritor.io");
        Projeto p = projetoComMembro("Projeto do Cronômetro", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);
        coluna(p, "Feito", 1);
        Card c = card(aFazer, responsavel, "Trabalhar nisto");

        chamar(responsavel, "POST", "/cards/" + c.getId() + "/cronometro/iniciar", null).expectStatus().isOk();
        chamar(responsavel, "POST", "/cards/" + c.getId() + "/cronometro/finalizar", "{\"descricao\":\"feito\"}")
                .expectStatus().isOk();

        org.assertj.core.api.Assertions.assertThat(cardRepository.findById(c.getId()).orElseThrow().getConcluidoEm())
                .isNotNull();
    }

    @Test
    void naoMembroQueNaoEResponsavelLevaNotFoundNoCronometro() {
        Usuario membro = novoUsuario("e2e-cron2-membro@escritor.io");
        Usuario responsavel = novoUsuario("e2e-cron2-resp@escritor.io");
        Usuario intruso = novoUsuario("e2e-cron2-intruso@escritor.io");
        Projeto p = projetoComMembro("Projeto Cronômetro Fechado", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);
        Card c = card(aFazer, responsavel, "Não é sua");

        chamar(intruso, "GET", "/cards/" + c.getId() + "/cronometro", null).expectStatus().isNotFound();
    }

    // ---- Atribuir responsável faz a pessoa virar membro do projeto ----

    @Test
    void criarCardComResponsavelNaoMembroTornaOResponsavelMembro() {
        Usuario membro = novoUsuario("e2e-atr-criar-membro@escritor.io");
        Usuario novo = novoUsuario("e2e-atr-criar-novo@escritor.io");
        Projeto p = projetoComMembro("Projeto Atribuir Criar", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);

        chamar(membro, "POST", "/colunas/" + aFazer.getId() + "/cards",
                "{\"titulo\":\"Nova\",\"responsavelId\":" + novo.getId() + "}")
                .expectStatus().is2xxSuccessful();

        org.assertj.core.api.Assertions.assertThat(membroProjetoRepository.existsByProjetoAndUsuario(p, novo)).isTrue();
        chamar(novo, "GET", "/projetos/" + p.getId(), null).expectStatus().isOk();
    }

    @Test
    void atualizarResponsavelParaNaoMembroTornaOResponsavelMembro() {
        Usuario membro = novoUsuario("e2e-atr-patch-membro@escritor.io");
        Usuario novo = novoUsuario("e2e-atr-patch-novo@escritor.io");
        Projeto p = projetoComMembro("Projeto Atribuir Patch", membro);
        Coluna aFazer = coluna(p, "A fazer", 0);
        Card c = card(aFazer, membro, "Reatribuir");

        chamar(membro, "PATCH", "/cards/" + c.getId(),
                "{\"titulo\":\"Reatribuir\",\"responsavelId\":" + novo.getId() + "}")
                .expectStatus().isOk();

        org.assertj.core.api.Assertions.assertThat(membroProjetoRepository.existsByProjetoAndUsuario(p, novo)).isTrue();
        chamar(novo, "GET", "/projetos/" + p.getId(), null).expectStatus().isOk();
    }

    @Test
    void projetoPessoalNuncaGanhaMembroMasOResponsavelAindaAgeNoCard() {
        Usuario dono = novoUsuario("e2e-atr-pessoal-dono@escritor.io");
        Usuario outro = novoUsuario("e2e-atr-pessoal-outro@escritor.io");
        Projeto p = projetoRepository.save(Projeto.pessoalDe(dono, LocalDate.now()));
        membroProjetoRepository.save(new MembroProjeto(p, dono));
        Coluna aFazer = coluna(p, "A fazer", 0);
        coluna(p, "Feito", 1);
        Card c = card(aFazer, dono, "Tarefa pessoal");

        chamar(dono, "PATCH", "/cards/" + c.getId(),
                "{\"titulo\":\"Tarefa pessoal\",\"responsavelId\":" + outro.getId() + "}")
                .expectStatus().isOk();

        org.assertj.core.api.Assertions.assertThat(membroProjetoRepository.existsByProjetoAndUsuario(p, outro)).isFalse();
        chamar(outro, "GET", "/projetos/" + p.getId(), null).expectStatus().isNotFound();
        patchEstado(outro, c.getId(), "FEITO", 200);
    }
}
