-- Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento sobre o que
-- foi feito no dia pelos funcionarios... todo dia na mesma hora". Linha única (id fixo 1) - só
-- existe um "chefe" configurado no sistema (mesma decisão de EVOLUTION_CHEFE_NUMERO), então uma
-- tabela de configuração normal (não por usuário) é suficiente.
CREATE TABLE configuracao_relatorio_diario (
    id BIGINT PRIMARY KEY,
    horario_envio TIME NOT NULL,
    habilitado BOOLEAN NOT NULL DEFAULT true,
    ultimo_envio_em TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_configuracao_relatorio_diario_singleton CHECK (id = 1)
);
