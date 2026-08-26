package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CriarUsuarioRequestTest {

    private static Validator validator;

    @BeforeAll
    static void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void rejeitaCargaDiariaZero() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 0);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("cargaDiariaMinutos");
    }

    @Test
    void rejeitaCargaDiariaNegativa() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, -60);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("cargaDiariaMinutos");
    }

    @Test
    void aceitaCargaDiariaPositiva() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes).isEmpty();
    }
}
