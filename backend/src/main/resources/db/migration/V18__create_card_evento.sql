CREATE TABLE card_evento (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES card (id),
    autor_id BIGINT NOT NULL REFERENCES usuario (id),
    tipo VARCHAR(30) NOT NULL,
    de VARCHAR(255),
    para VARCHAR(255),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_card_evento_tipo CHECK (tipo IN ('CRIACAO', 'MUDANCA_COLUNA', 'MUDANCA_RESPONSAVEL'))
);

CREATE INDEX idx_card_evento_card ON card_evento (card_id);
