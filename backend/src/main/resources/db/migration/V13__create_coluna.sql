CREATE TABLE coluna (
    id BIGSERIAL PRIMARY KEY,
    quadro_id BIGINT NOT NULL REFERENCES quadro (id),
    nome VARCHAR(255) NOT NULL,
    ordem INTEGER NOT NULL,
    limite_wip INTEGER,
    CONSTRAINT uk_coluna_quadro_ordem UNIQUE (quadro_id, ordem),
    CONSTRAINT ck_coluna_limite_wip_positivo CHECK (limite_wip IS NULL OR limite_wip > 0)
);

CREATE INDEX idx_coluna_quadro ON coluna (quadro_id);
