package io.escritor.presenca.escala.service;

import io.escritor.presenca.escala.domain.EscalaExcecao;
import io.escritor.presenca.escala.domain.EscalaSemanal;
import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.escala.repository.EscalaExcecaoRepository;
import io.escritor.presenca.escala.repository.EscalaSemanalRepository;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.escala.web.EscalaEquipeResponse;
import io.escritor.presenca.escala.web.EscalaExcecaoResponse;
import io.escritor.presenca.escala.web.EscalaSemanalResponse;
import io.escritor.presenca.escala.web.ItemEscalaSemanalRequest;
import io.escritor.presenca.escala.web.SalvarExcecaoRequest;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Calendário individual de escala de trabalho (pedido do usuário: "calendário individual para
 * indicar os dias que ira trabalhar com opção de deixar sempre a configuração ou poder mudar
 * também o dia e hora"). Todo método aqui atua sempre sobre o PRÓPRIO usuário passado - ninguém
 * edita a escala de outra pessoa, nem ADMIN; {@link #calcularEfetivaDaEquipe} é a única exceção,
 * e é somente leitura (pedido: "para o admin/chefe conseguir ver os momentos em que os
 * funcionários estarão trabalhando").
 */
@Service
public class EscalaService {

    private static final long MAXIMO_DIAS_NO_INTERVALO = 366;

    private final EscalaSemanalRepository escalaSemanalRepository;
    private final EscalaExcecaoRepository escalaExcecaoRepository;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;

    public EscalaService(
            EscalaSemanalRepository escalaSemanalRepository,
            EscalaExcecaoRepository escalaExcecaoRepository,
            VisibilidadeUsuarioService visibilidadeUsuarioService) {
        this.escalaSemanalRepository = escalaSemanalRepository;
        this.escalaExcecaoRepository = escalaExcecaoRepository;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
    }

    public List<EscalaSemanalResponse> listarSemanal(Usuario usuario) {
        return escalaSemanalRepository.findByUsuario(usuario).stream()
                .sorted(Comparator.comparing(EscalaSemanal::getDiaSemana))
                .map(EscalaSemanalResponse::de)
                .toList();
    }

    /**
     * Substitui o padrão semanal inteiro pelo enviado - mais simples que diff incremental pra uma
     * tela que salva a semana toda de uma vez (pedido: "fácil de adicionar as datas e horários").
     * Um dia que não aparecer em {@code itens} passa a não ter mais linha, ou seja, "não trabalho
     * mais nesse dia".
     */
    @Transactional
    public List<EscalaSemanalResponse> definirSemanal(Usuario usuario, List<ItemEscalaSemanalRequest> itens) {
        long diasUnicos = itens.stream().map(ItemEscalaSemanalRequest::diaSemana).distinct().count();
        if (diasUnicos != itens.size()) {
            throw new HorarioInvalidoException("Cada dia da semana só pode aparecer uma vez no padrão semanal");
        }

        escalaSemanalRepository.deleteByUsuario(usuario);
        escalaSemanalRepository.flush();
        List<EscalaSemanal> novas = itens.stream()
                .map(item -> new EscalaSemanal(usuario, item.diaSemana(), item.horaInicio(), item.horaFim()))
                .toList();
        return escalaSemanalRepository.saveAll(novas).stream()
                .sorted(Comparator.comparing(EscalaSemanal::getDiaSemana))
                .map(EscalaSemanalResponse::de)
                .toList();
    }

    public List<EscalaExcecaoResponse> listarExcecoes(Usuario usuario, LocalDate inicio, LocalDate fim) {
        validarIntervalo(inicio, fim);
        return escalaExcecaoRepository.findByUsuarioAndDataBetween(usuario, inicio, fim).stream()
                .sorted(Comparator.comparing(EscalaExcecao::getData))
                .map(EscalaExcecaoResponse::de)
                .toList();
    }

    /** Upsert por data: uma segunda chamada pra mesma data atualiza a exceção já existente. */
    @Transactional
    public EscalaExcecaoResponse salvarExcecao(Usuario usuario, SalvarExcecaoRequest request) {
        EscalaExcecao excecao = escalaExcecaoRepository
                .findByUsuarioAndData(usuario, request.data())
                .map(existente -> {
                    existente.atualizar(request.trabalha(), request.horaInicio(), request.horaFim(), request.observacao());
                    return existente;
                })
                .orElseGet(() -> new EscalaExcecao(
                        usuario, request.data(), request.trabalha(), request.horaInicio(), request.horaFim(), request.observacao()));
        return EscalaExcecaoResponse.de(escalaExcecaoRepository.save(excecao));
    }

    /** Remove a exceção - a data volta a valer o padrão semanal (ou "não trabalha", se não houver). */
    @Transactional
    public void removerExcecao(Usuario usuario, Long excecaoId) {
        EscalaExcecao excecao = escalaExcecaoRepository
                .findByIdAndUsuario(excecaoId, usuario)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Exceção de escala não encontrada: " + excecaoId));
        escalaExcecaoRepository.delete(excecao);
    }

    /**
     * Mescla padrão semanal + exceções pontuais dia a dia no intervalo - exceção sempre tem
     * prioridade sobre o padrão da semana; sem os dois, o dia é "não trabalha". Único lugar com
     * essa regra: reusado tanto pelo calendário do próprio usuário (`GET /escala/efetiva`) quanto
     * pela visão de equipe do gestor ({@link #calcularEfetivaDaEquipe}).
     */
    public List<DiaEfetivoResponse> calcularEfetiva(Usuario usuario, LocalDate inicio, LocalDate fim) {
        validarIntervalo(inicio, fim);
        Map<DayOfWeek, EscalaSemanal> padraoPorDia = escalaSemanalRepository.findByUsuario(usuario).stream()
                .collect(Collectors.toMap(EscalaSemanal::getDiaSemana, Function.identity()));
        Map<LocalDate, EscalaExcecao> excecoesPorData = escalaExcecaoRepository
                .findByUsuarioAndDataBetween(usuario, inicio, fim).stream()
                .collect(Collectors.toMap(EscalaExcecao::getData, Function.identity()));

        List<DiaEfetivoResponse> dias = new ArrayList<>();
        for (LocalDate data = inicio; !data.isAfter(fim); data = data.plusDays(1)) {
            EscalaExcecao excecao = excecoesPorData.get(data);
            if (excecao != null) {
                dias.add(new DiaEfetivoResponse(data, excecao.isTrabalha(), excecao.getHoraInicio(), excecao.getHoraFim()));
                continue;
            }
            EscalaSemanal padrao = padraoPorDia.get(data.getDayOfWeek());
            dias.add(padrao != null
                    ? new DiaEfetivoResponse(data, true, padrao.getHoraInicio(), padrao.getHoraFim())
                    : new DiaEfetivoResponse(data, false, null, null));
        }
        return dias;
    }

    /**
     * Pedido do usuário: "para que o admin/chefe conseguir ver os momentos em que os funcionários
     * estarão trabalhando". Reaproveita {@link VisibilidadeUsuarioService#listarUsuariosVisiveis}
     * (ADMIN vê todo mundo, GESTOR vê quem está nos mesmos projetos) - sempre somente leitura,
     * ninguém edita a escala de outra pessoa por aqui.
     */
    public List<EscalaEquipeResponse> calcularEfetivaDaEquipe(Usuario requisitante, LocalDate inicio, LocalDate fim) {
        return visibilidadeUsuarioService.listarUsuariosVisiveis(requisitante).stream()
                .map(usuario -> new EscalaEquipeResponse(usuario.getId(), usuario.getNome(), calcularEfetiva(usuario, inicio, fim)))
                .toList();
    }

    private static void validarIntervalo(LocalDate inicio, LocalDate fim) {
        if (fim.isBefore(inicio)) {
            throw new HorarioInvalidoException("A data de fim não pode ser antes da data de início");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) > MAXIMO_DIAS_NO_INTERVALO) {
            throw new HorarioInvalidoException("Intervalo de datas grande demais (máximo de " + MAXIMO_DIAS_NO_INTERVALO + " dias)");
        }
    }
}
