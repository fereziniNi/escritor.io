package io.escritor.presenca.skills.domain;

/** Ação reservada a GESTOR/ADMIN (aprovar, rejeitar, oficializar, arquivar) feita por outro papel. */
public class AcaoSkillNaoPermitidaException extends RuntimeException {

    public AcaoSkillNaoPermitidaException(String mensagem) {
        super(mensagem);
    }
}
