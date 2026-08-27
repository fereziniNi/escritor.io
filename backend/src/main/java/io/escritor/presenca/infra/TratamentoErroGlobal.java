package io.escritor.presenca.infra;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
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
}
