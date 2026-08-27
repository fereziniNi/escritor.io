-- Correção de uma marcação nunca edita o registro original (registro_ponto é append-only, ver
-- V8): aprovar uma SolicitacaoAjustePonto (S2.12) sempre INSERE um novo registro_ponto, com
-- substitui_id apontando pro original quando existe um (null = marcação esquecida, não existia
-- registro nenhum pra substituir).
ALTER TABLE registro_ponto ADD COLUMN substitui_id BIGINT REFERENCES registro_ponto (id);
