CREATE TABLE card_comentario (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES card (id),
    autor_id BIGINT NOT NULL REFERENCES usuario (id),
    texto TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_comentario_card ON card_comentario (card_id);
