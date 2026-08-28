CREATE TABLE etiqueta (
    id BIGSERIAL PRIMARY KEY,
    quadro_id BIGINT NOT NULL REFERENCES quadro (id),
    nome VARCHAR(255) NOT NULL,
    cor VARCHAR(255) NOT NULL
);

CREATE INDEX idx_etiqueta_quadro ON etiqueta (quadro_id);
