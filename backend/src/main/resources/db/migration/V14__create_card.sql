CREATE TABLE card (
    id BIGSERIAL PRIMARY KEY,
    coluna_id BIGINT NOT NULL REFERENCES coluna (id),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    posicao DOUBLE PRECISION NOT NULL,
    responsavel_id BIGINT REFERENCES usuario (id),
    prazo DATE,
    estimativa_minutos INTEGER,
    criado_por BIGINT NOT NULL REFERENCES usuario (id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    arquivado BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT ck_card_estimativa_positiva CHECK (estimativa_minutos IS NULL OR estimativa_minutos > 0)
);

CREATE INDEX idx_card_coluna ON card (coluna_id);
