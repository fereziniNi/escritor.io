package io.escritor.presenca.infra;

import io.escritor.presenca.chat.domain.AcessoNegadoAConversaException;
import io.escritor.presenca.chat.domain.ConversaInvalidaException;
import io.escritor.presenca.escala.domain.HorarioInvalidoException;
import io.escritor.presenca.googlecalendar.domain.EstadoOAuthInvalidoException;
import io.escritor.presenca.googlecalendar.domain.GoogleIntegracaoDesabilitadaException;
import io.escritor.presenca.googlecalendar.domain.GoogleNaoConectadoException;
import io.escritor.presenca.happyhour.domain.DescricaoAtividadeObrigatoriaException;
import io.escritor.presenca.happyhour.domain.NenhumaAtividadeParaSortearException;
import io.escritor.presenca.identidade.domain.AparenciaInvalidaException;
import io.escritor.presenca.identidade.domain.EmailJaCadastradoException;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.CronometroJaEmAndamentoException;
import io.escritor.presenca.kanban.domain.CronometroNaoIniciadoException;
import io.escritor.presenca.kanban.domain.EstimativaInvalidaException;
import io.escritor.presenca.kanban.domain.FiltroRelatorioInvalidoException;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.domain.LimiteWipInvalidoException;
import io.escritor.presenca.kanban.domain.NomeColunaObrigatorioException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.domain.TextoComentarioObrigatorioException;
import io.escritor.presenca.kanban.domain.TituloCardObrigatorioException;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.service.SequenciaInvalidaException;
import io.escritor.presenca.relatorio.domain.EstatisticasDeOutroUsuarioException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class TratamentoErroGlobal {

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    ResponseEntity<Void> tratarRecursoNaoEncontrado() {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(SequenciaInvalidaException.class)
    ResponseEntity<Void> tratarSequenciaInvalida() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(NomeColunaObrigatorioException.class)
    ResponseEntity<Void> tratarNomeColunaObrigatorio() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(LimiteWipInvalidoException.class)
    ResponseEntity<Void> tratarLimiteWipInvalido() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(LimiteWipExcedidoException.class)
    ResponseEntity<Void> tratarLimiteWipExcedido() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(OrdemColunaDuplicadaException.class)
    ResponseEntity<Void> tratarOrdemColunaDuplicada() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(TituloCardObrigatorioException.class)
    ResponseEntity<Void> tratarTituloCardObrigatorio() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(EstimativaInvalidaException.class)
    ResponseEntity<Void> tratarEstimativaInvalida() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(TextoComentarioObrigatorioException.class)
    ResponseEntity<Void> tratarTextoComentarioObrigatorio() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(AcessoNegadoException.class)
    ResponseEntity<Void> tratarAcessoNegado() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @ExceptionHandler(CronometroJaEmAndamentoException.class)
    ResponseEntity<Void> tratarCronometroJaEmAndamento() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(CronometroNaoIniciadoException.class)
    ResponseEntity<Void> tratarCronometroNaoIniciado() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(JornadaDeOutroUsuarioException.class)
    ResponseEntity<Void> tratarJornadaDeOutroUsuario() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @ExceptionHandler(FiltroRelatorioInvalidoException.class)
    ResponseEntity<Void> tratarFiltroRelatorioInvalido() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(AparenciaInvalidaException.class)
    ResponseEntity<Void> tratarAparenciaInvalida() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(EmailJaCadastradoException.class)
    ResponseEntity<Void> tratarEmailJaCadastrado() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(HorarioInvalidoException.class)
    ResponseEntity<Void> tratarHorarioInvalido() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(GoogleIntegracaoDesabilitadaException.class)
    ResponseEntity<Void> tratarGoogleIntegracaoDesabilitada() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
    }

    @ExceptionHandler(GoogleNaoConectadoException.class)
    ResponseEntity<Void> tratarGoogleNaoConectado() {
        return ResponseEntity.status(HttpStatus.PRECONDITION_REQUIRED).build();
    }

    @ExceptionHandler(EstadoOAuthInvalidoException.class)
    ResponseEntity<Void> tratarEstadoOAuthInvalido() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(ConversaInvalidaException.class)
    ResponseEntity<Void> tratarConversaInvalida() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(AcessoNegadoAConversaException.class)
    ResponseEntity<Void> tratarAcessoNegadoAConversa() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @ExceptionHandler(DescricaoAtividadeObrigatoriaException.class)
    ResponseEntity<Void> tratarDescricaoAtividadeObrigatoria() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(NenhumaAtividadeParaSortearException.class)
    ResponseEntity<Void> tratarNenhumaAtividadeParaSortear() {
        return ResponseEntity.status(HttpStatus.CONFLICT).build();
    }

    @ExceptionHandler(EstatisticasDeOutroUsuarioException.class)
    ResponseEntity<Void> tratarEstatisticasDeOutroUsuario() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

}
