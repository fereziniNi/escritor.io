package io.escritor.presenca.skills.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.skills.domain.AcaoSkillNaoPermitidaException;
import org.junit.jupiter.api.Test;

/** A fila de propostas passa pela checagem de gestor do serviço, além do {@code @PreAuthorize}. */
class SkillFachadaTest {

    private final SkillService skillService = mock(SkillService.class);
    private final SkillConsultaService consulta = mock(SkillConsultaService.class);
    private final SkillFachada fachada = new SkillFachada(skillService, consulta);

    @Test
    void propostasExigemGestorNoServico() {
        Usuario ana = new Usuario("Ana", "ana@escritor.io", Papel.COLABORADOR, 480);
        doThrow(new AcaoSkillNaoPermitidaException("só gestor")).when(skillService).exigirGestorParaPropostas(ana);

        assertThatThrownBy(() -> fachada.propostas(ana)).isInstanceOf(AcaoSkillNaoPermitidaException.class);
        verify(skillService).exigirGestorParaPropostas(ana);
    }
}
