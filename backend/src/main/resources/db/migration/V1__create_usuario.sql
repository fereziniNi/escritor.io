CREATE TABLE usuario (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    papel VARCHAR(20) NOT NULL,
    carga_diaria_minutos INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_usuario_email UNIQUE (email),
    CONSTRAINT ck_usuario_papel CHECK (papel IN ('COLABORADOR', 'GESTOR', 'ADMIN')),
    CONSTRAINT ck_usuario_carga_diaria_positiva CHECK (carga_diaria_minutos > 0)
);
