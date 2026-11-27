package io.escritor.presenca.skills.domain;

/** Ações sobre a skill que não geram versão nova (ficam só no histórico de eventos). */
public enum TipoEventoSkill {
    OFICIALIZADA, OFICIAL_REMOVIDO, ARQUIVADA, DESARQUIVADA
}
