CREATE TABLE apontamento (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    card_id BIGINT NOT NULL REFERENCES card (id),
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ,
    minutos INTEGER,
    descricao TEXT,
    origem VARCHAR(10) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    editado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_apontamento_origem CHECK (origem IN ('TIMER', 'MANUAL')),
    CONSTRAINT ck_apontamento_fim_apos_inicio CHECK (fim IS NULL OR fim >= inicio),
    CONSTRAINT ck_apontamento_minutos_so_com_fim CHECK (minutos IS NULL OR fim IS NOT NULL)
);

CREATE INDEX idx_apontamento_usuario ON apontamento (usuario_id);
CREATE INDEX idx_apontamento_card ON apontamento (card_id);

-- PRD: "no máximo um timer aberto por usuário" - garantido em banco, não só no serviço (S4.2),
-- pra sobreviver até a corrida entre duas requisições concorrentes de start-timer.
CREATE UNIQUE INDEX uk_apontamento_timer_aberto_por_usuario ON apontamento (usuario_id) WHERE fim IS NULL;
