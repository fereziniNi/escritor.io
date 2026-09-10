-- Pedido do usuário: "Remova atualmente o apontamento, minutos trabalhados, descrição, deixe
-- somente um contador de tempo onde a pessoa inicia, pausa e finaliza e descreve o que foi feito
-- quando finaliza a tarefa" - substitui os lançamentos manuais (`apontamento`) por sessões de
-- cronômetro por card (`sessao_trabalho`, `fim` nulo = sessão aberta agora).
CREATE TABLE sessao_trabalho (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES card (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ
);
CREATE INDEX idx_sessao_trabalho_card ON sessao_trabalho (card_id);
CREATE INDEX idx_sessao_trabalho_usuario ON sessao_trabalho (usuario_id, inicio);

-- a descrição deixa de ser por lançamento e passa a ser uma só, pedida ao finalizar a tarefa
-- inteira.
ALTER TABLE card ADD COLUMN descricao_conclusao TEXT;
ALTER TABLE card ADD COLUMN concluido_em TIMESTAMPTZ;

DROP TABLE apontamento;

ALTER TABLE card_evento DROP CONSTRAINT ck_card_evento_tipo;
ALTER TABLE card_evento ADD CONSTRAINT ck_card_evento_tipo
    CHECK (tipo IN ('CRIACAO', 'MUDANCA_COLUNA', 'MUDANCA_RESPONSAVEL', 'INICIOU_TRABALHO', 'PAUSOU_TRABALHO', 'FINALIZOU_TRABALHO'));
