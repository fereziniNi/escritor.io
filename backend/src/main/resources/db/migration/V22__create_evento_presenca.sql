CREATE TABLE evento_presenca (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    zona_id BIGINT NOT NULL REFERENCES zona (id),
    entrou_em TIMESTAMPTZ NOT NULL,
    saiu_em TIMESTAMPTZ
);

CREATE INDEX idx_evento_presenca_usuario ON evento_presenca (usuario_id);
CREATE INDEX idx_evento_presenca_zona ON evento_presenca (zona_id);
