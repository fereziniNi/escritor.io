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
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 0, null);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("cargaDiariaMinutos");
    }

    @Test
    void rejeitaCargaDiariaNegativa() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, -60, null);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("cargaDiariaMinutos");
    }

    @Test
    void aceitaCargaDiariaPositiva() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, null);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes).isEmpty();
    }

    // ---------- pedido do usuário: avisar por WhatsApp de tarefa concluída/mensagem de chat ----------

    @Test
    void aceitaWhatsappNulo() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, null);

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes).isEmpty();
    }

    @Test
    void aceitaWhatsappVazio() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, "");

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes).isEmpty();
    }

    @Test
    void aceitaWhatsappSoComDigitos() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, "5511999998888");

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes).isEmpty();
    }

    @Test
    void rejeitaWhatsappComLetra() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, "não é número");

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("whatsapp");
    }

    @Test
    void rejeitaWhatsappCurtoDemais() {
        CriarUsuarioRequest request =
                new CriarUsuarioRequest("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360, "123");

        Set<ConstraintViolation<CriarUsuarioRequest>> violacoes = validator.validate(request);

        assertThat(violacoes)
                .extracting(v -> v.getPropertyPath().toString())
                .contains("whatsapp");
    }
}
