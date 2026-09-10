package io.escritor.presenca.reuniao.service;

import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.escala.service.EscalaService;
import io.escritor.presenca.escala.web.DiaEfetivoResponse;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler;
import io.escritor.presenca.escritorio.ws.PresencaWebSocketHandler.ConviteReuniaoWs;
import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.googlecalendar.service.GoogleMeetService;
import io.escritor.presenca.googlecalendar.service.GoogleOAuthService;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.identidade.service.VisibilidadeUsuarioService;
import io.escritor.presenca.notificacao.domain.TipoNotificacao;
import io.escritor.presenca.notificacao.service.NotificacaoService;
import io.escritor.presenca.reuniao.domain.Reuniao;
import io.escritor.presenca.reuniao.repository.ReuniaoRepository;
import io.escritor.presenca.reuniao.web.CriarReuniaoRequest;
import io.escritor.presenca.reuniao.web.ReuniaoResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema (independente) vai conseguir marcar e entrar nas reuniões do meet pela nossa
 * plataforma... deixar disponível para entrar na reunião com quem ele quer dos funcionários".
 * Evolução do que já existia (só chefe marcava, com um funcionário só, sem Meet): agora qualquer
 * usuário autenticado cria, com um ou mais participantes - a única exigência é ter conectado a
 * própria conta Google (é o organizador que gera o link do Meet). Confirmado com o usuário: o
 * horário escolhido ainda precisa caber no expediente efetivo de CADA participante (não do
 * criador).
 */
@Service
public class ReuniaoService {

    private static final Logger log = LoggerFactory.getLogger(ReuniaoService.class);

    private final ReuniaoRepository reuniaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EscalaService escalaService;
    private final VisibilidadeUsuarioService visibilidadeUsuarioService;
    private final GoogleOAuthService googleOAuthService;
    private final GoogleMeetService googleMeetService;
    private final PresencaWebSocketHandler presencaWebSocketHandler;
    private final NotificacaoService notificacaoService;
    private final Clock clock;

    public ReuniaoService(
            ReuniaoRepository reuniaoRepository,
            UsuarioRepository usuarioRepository,
            EscalaService escalaService,
            VisibilidadeUsuarioService visibilidadeUsuarioService,
            GoogleOAuthService googleOAuthService,
            GoogleMeetService googleMeetService,
            PresencaWebSocketHandler presencaWebSocketHandler,
            NotificacaoService notificacaoService,
            Clock clock) {
        this.reuniaoRepository = reuniaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.escalaService = escalaService;
        this.visibilidadeUsuarioService = visibilidadeUsuarioService;
        this.googleOAuthService = googleOAuthService;
        this.googleMeetService = googleMeetService;
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.notificacaoService = notificacaoService;
        this.clock = clock;
    }

    /**
     * Valida, nessa ordem: (1) o criador conectou o Google (sem isso não existe link de Meet pra
     * gerar); (2) todos os participantes existem; (3) cada um deles efetivamente trabalha nesse
     * dia (padrão semanal ou exceção) e o intervalo pedido está inteiramente contido no expediente
     * efetivo de cada um; (4) o intervalo não sobrepõe outra reunião já marcada pra cada um deles.
     * A chamada à Google é síncrona de propósito (pedido: "disponibilizar o link caso queira
     * compartilhar" - precisa vir na própria resposta desta criação) - se falhar, a
     * {@code @Transactional} desfaz a criação também, sem deixar reunião "pela metade".
     */
    @Transactional
    public ReuniaoResponse criar(Usuario criador, CriarReuniaoRequest request) {
        if (!googleOAuthService.estaConectado(criador)) {
            throw new GoogleNaoConectadoException();
        }

        List<Usuario> participantes = usuarioRepository.findAllById(request.participantesIds());
        if (participantes.size() != request.participantesIds().size()) {
            throw new RecursoNaoEncontradoException("Um ou mais participantes não encontrados");
        }
        for (Usuario participante : participantes) {
            validarDentroDoExpedienteEfetivo(participante, request);
            validarSemSobreposicao(participante, request);
        }

        Reuniao reuniao = new Reuniao(
                criador, participantes, request.data(), request.horaInicio(), request.horaFim(), request.titulo(), Instant.now(clock));
        Reuniao salva = reuniaoRepository.save(reuniao);

        String linkMeet = googleMeetService.criarEventoComMeet(criador, salva);
        salva.definirLinkMeet(linkMeet);
        salva = reuniaoRepository.save(salva);

        for (Usuario participante : participantes) {
            presencaWebSocketHandler.avisarConvite(participante.getId(), new ConviteReuniaoWs(
                    salva.getId(), salva.getTitulo(), criador.getNome(), salva.getData().toString(),
                    salva.getHoraInicio().toString(), salva.getHoraFim().toString(), salva.getLinkMeet()));
            notificacaoService.registrar(
                    participante, TipoNotificacao.CONVITE_REUNIAO, criador.getNome() + " te chamou para \"" + salva.getTitulo() + "\"",
                    salva.getLinkMeet());
        }
        return ReuniaoResponse.de(salva);
    }

    /** Pedido do usuário: reunião "aparece na agenda dela [do convidado] no app" - reuniões onde o
     * usuário é criador OU participante (antes só olhava "funcionário"). {@code @Transactional}
     * aqui é necessário (achado ao testar contra o banco de verdade, não pego pelos testes com
     * mock): {@link Reuniao#participantes} é {@code @OneToMany} preguiçoso, e {@link
     * ReuniaoResponse#de} precisa iterar essa coleção - sem uma sessão Hibernate aberta até o fim
     * do mapeamento, estoura {@code LazyInitializationException}. */
    @Transactional(readOnly = true)
    public List<ReuniaoResponse> listarMinhas(Usuario usuario, LocalDate inicio, LocalDate fim) {
        Map<Long, Reuniao> porId = new LinkedHashMap<>();
        reuniaoRepository.findByCriadorAndDataBetween(usuario, inicio, fim).forEach(r -> porId.put(r.getId(), r));
        reuniaoRepository.findByParticipantes_UsuarioAndDataBetween(usuario, inicio, fim).forEach(r -> porId.put(r.getId(), r));
        return porId.values().stream()
                .sorted(Comparator.comparing(Reuniao::getData).thenComparing(Reuniao::getHoraInicio))
                .map(ReuniaoResponse::de)
                .toList();
    }

    /** Pedido: "para o admin/chefe conseguir ver" - mesma lista de visíveis usada em {@code
     * /escala/equipe}. {@code @Transactional} pelo mesmo motivo de {@link #listarMinhas}. */
    @Transactional(readOnly = true)
    public List<ReuniaoResponse> listarDaEquipe(Usuario chefe, LocalDate inicio, LocalDate fim) {
        List<Usuario> visiveis = visibilidadeUsuarioService.listarUsuariosVisiveis(chefe);
        return reuniaoRepository.findDistinctByParticipantes_UsuarioInAndDataBetween(visiveis, inicio, fim).stream()
                .sorted(Comparator.comparing(Reuniao::getData).thenComparing(Reuniao::getHoraInicio))
                .map(ReuniaoResponse::de)
                .toList();
    }

    /** Só quem criou pode cancelar. Cancelar do nosso lado nunca fica bloqueado por uma falha da
     * Google (melhor esforço - loga e segue, não propaga). */
    @Transactional
    public void remover(Usuario criador, Long reuniaoId) {
        Reuniao reuniao = reuniaoRepository
                .findByIdAndCriador(reuniaoId, criador)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Reunião não encontrada: " + reuniaoId));
        reuniaoRepository.delete(reuniao);
        try {
            googleMeetService.removerEvento(criador, reuniaoId);
        } catch (RuntimeException erro) {
            log.warn("Falha ao remover o evento do Meet da reunião {}", reuniaoId, erro);
        }
    }

    private void validarDentroDoExpedienteEfetivo(Usuario participante, CriarReuniaoRequest request) {
        List<DiaEfetivoResponse> dias = escalaService.calcularEfetiva(participante, request.data(), request.data());
        DiaEfetivoResponse dia = dias.get(0);
        boolean dentroDoExpediente = dia.trabalha()
                && dia.horaInicio() != null
                && dia.horaFim() != null
                && !request.horaInicio().isBefore(dia.horaInicio())
                && !request.horaFim().isAfter(dia.horaFim());
        if (!dentroDoExpediente) {
            throw new HorarioInvalidoException(
                    "A reunião precisa estar dentro do horário em que " + participante.getNome() + " vai trabalhar nesse dia");
        }
    }

    private void validarSemSobreposicao(Usuario participante, CriarReuniaoRequest request) {
        boolean sobrepoe = reuniaoRepository.findByParticipantes_UsuarioAndData(participante, request.data()).stream()
                .anyMatch(existente -> request.horaInicio().isBefore(existente.getHoraFim())
                        && request.horaFim().isAfter(existente.getHoraInicio()));
        if (sobrepoe) {
            throw new HorarioInvalidoException("Já existe uma reunião marcada nesse horário para " + participante.getNome());
        }
    }
}
