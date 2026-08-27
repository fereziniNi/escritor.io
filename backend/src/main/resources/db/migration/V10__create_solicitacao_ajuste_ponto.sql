CREATE TABLE solicitacao_ajuste_ponto (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    registro_alvo_id BIGINT REFERENCES registro_ponto (id),
    tipo_solicitado VARCHAR(20) NOT NULL,
    momento_solicitado TIMESTAMPTZ NOT NULL,
    justificativa TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    avaliador_id BIGINT REFERENCES usuario (id),
    avaliado_em TIMESTAMPTZ,
    parecer TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_solicitacao_ajuste_tipo CHECK (tipo_solicitado IN ('ENTRADA', 'SAIDA', 'PAUSA_INICIO', 'PAUSA_FIM')),
    CONSTRAINT ck_solicitacao_ajuste_status CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA')),
    CONSTRAINT ck_solicitacao_ajuste_justificativa_nao_vazia CHECK (btrim(justificativa) <> '')
);

CREATE INDEX idx_solicitacao_ajuste_usuario ON solicitacao_ajuste_ponto (usuario_id);

-- Diferente de registro_ponto, esta tabela NÃO é append-only: status/avaliador_id/avaliado_em/
-- parecer são preenchidos por UPDATE quando o gestor decide (S2.12). A garantia de integridade do
-- PRD (§3.2) é sobre a marcação em si (registro_ponto) - aprovar uma solicitação nunca edita o
-- registro original, sempre insere um novo apontando pra ele via substitui_id.
