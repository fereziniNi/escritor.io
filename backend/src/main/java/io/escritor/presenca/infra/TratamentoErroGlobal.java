package io.escritor.presenca.infra;

import io.escritor.presenca.apontamento.domain.ApontamentoDeOutroUsuarioException;
import io.escritor.presenca.apontamento.domain.FiltroRelatorioInvalidoException;
import io.escritor.presenca.apontamento.domain.FimAntesDoInicioException;
import io.escritor.presenca.apontamento.domain.LancamentoManualInvalidoException;
import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import io.escritor.presenca.kanban.domain.AcessoNegadoException;
import io.escritor.presenca.kanban.domain.EstimativaInvalidaException;
import io.escritor.presenca.kanban.domain.LimiteWipExcedidoException;
import io.escritor.presenca.kanban.domain.LimiteWipInvalidoException;
import io.escritor.presenca.kanban.domain.NomeColunaObrigatorioException;
import io.escritor.presenca.kanban.domain.OrdemColunaDuplicadaException;
import io.escritor.presenca.kanban.domain.TextoComentarioObrigatorioException;
import io.escritor.presenca.kanban.domain.TituloCardObrigatorioException;
import io.escritor.presenca.ponto.domain.JornadaDeOutroUsuarioException;
import io.escritor.presenca.ponto.service.SequenciaInvalidaException;
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

    @ExceptionHandler(ApontamentoDeOutroUsuarioException.class)
    ResponseEntity<Void> tratarApontamentoDeOutroUsuario() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @ExceptionHandler(FimAntesDoInicioException.class)
    ResponseEntity<Void> tratarFimAntesDoInicio() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(LancamentoManualInvalidoException.class)
    ResponseEntity<Void> tratarLancamentoManualInvalido() {
        return ResponseEntity.badRequest().build();
    }

    @ExceptionHandler(JornadaDeOutroUsuarioException.class)
    ResponseEntity<Void> tratarJornadaDeOutroUsuario() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    @ExceptionHandler(FiltroRelatorioInvalidoException.class)
    ResponseEntity<Void> tratarFiltroRelatorioInvalido() {
        return ResponseEntity.badRequest().build();
    }

}
