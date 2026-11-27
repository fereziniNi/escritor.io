-- Registro manual de período trabalhado: além do cronômetro, a pessoa pode lançar um período já
-- trabalhado (início e fim informados). `origem` distingue as duas formas; um registro MANUAL
-- nasce sempre fechado (fim preenchido) e nenhum período termina antes de começar.
--
-- Reconstruída a partir do schema de produção (aplicada em 23/09/2026, arquivo original perdido).
ALTER TABLE sessao_trabalho ADD COLUMN origem VARCHAR(10) NOT NULL DEFAULT 'CRONOMETRO';

ALTER TABLE sessao_trabalho
    ADD CONSTRAINT ck_sessao_trabalho_origem CHECK (origem IN ('CRONOMETRO', 'MANUAL'));
ALTER TABLE sessao_trabalho
    ADD CONSTRAINT ck_sessao_trabalho_fim_apos_inicio CHECK (fim IS NULL OR fim >= inicio);
ALTER TABLE sessao_trabalho
    ADD CONSTRAINT ck_sessao_trabalho_manual_sempre_fechada CHECK (origem <> 'MANUAL' OR fim IS NOT NULL);

-- o histórico do card ganha o tipo de evento do lançamento manual
ALTER TABLE card_evento DROP CONSTRAINT ck_card_evento_tipo;
ALTER TABLE card_evento
    ADD CONSTRAINT ck_card_evento_tipo CHECK (tipo IN (
        'CRIACAO', 'MUDANCA_COLUNA', 'MUDANCA_RESPONSAVEL',
        'INICIOU_TRABALHO', 'PAUSOU_TRABALHO', 'FINALIZOU_TRABALHO', 'REGISTROU_PERIODO'));
