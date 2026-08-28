CREATE TABLE card_etiqueta (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES card (id),
    etiqueta_id BIGINT NOT NULL REFERENCES etiqueta (id),
    CONSTRAINT uk_card_etiqueta_card_etiqueta UNIQUE (card_id, etiqueta_id)
);

CREATE INDEX idx_card_etiqueta_card ON card_etiqueta (card_id);
