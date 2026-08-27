CREATE TABLE registro_ponto (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    tipo VARCHAR(20) NOT NULL,
    momento TIMESTAMPTZ NOT NULL,
    origem VARCHAR(20) NOT NULL,
    ip VARCHAR(45),
    user_agent VARCHAR(500),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_registro_ponto_tipo CHECK (tipo IN ('ENTRADA', 'SAIDA', 'PAUSA_INICIO', 'PAUSA_FIM')),
    CONSTRAINT ck_registro_ponto_origem CHECK (origem IN ('WEB', 'AJUSTE_APROVADO', 'ADMIN'))
);

CREATE INDEX idx_registro_ponto_usuario ON registro_ponto (usuario_id);

-- A garantia mais barata e mais forte do sistema de ponto (ver PRD §3.2): a aplicação, rodando
-- como presenca_app (não dona da tabela - ver db-init/criar-papel-app.sql), nunca consegue
-- alterar ou apagar uma marcação já gravada. Correção é sempre um INSERT novo apontando pro
-- registro original via substitui_id (adicionado na fatia S2.12).
REVOKE UPDATE, DELETE ON registro_ponto FROM presenca_app;
