package io.escritor.presenca.infra;

import io.escritor.presenca.identidade.service.RecursoNaoEncontradoException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class TratamentoErroGlobal {

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    ResponseEntity<Void> tratarRecursoNaoEncontrado() {
        return ResponseEntity.notFound().build();
    }
}
