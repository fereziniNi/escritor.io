CREATE TABLE codigo_acesso (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    codigo_hash VARCHAR(255) NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    usado_em TIMESTAMPTZ,
    tentativas INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_codigo_acesso_tentativas_nao_negativas CHECK (tentativas >= 0)
);

CREATE INDEX idx_codigo_acesso_usuario ON codigo_acesso (usuario_id);
