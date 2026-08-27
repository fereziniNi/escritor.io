-- Encadeamento de integridade do PRD §3.2: hash = SHA-256(usuario_id | tipo | momento | origem |
-- hash_anterior), onde hash_anterior é o hash do último registro daquele usuário. Combinado com
-- o REVOKE UPDATE/DELETE (V8), qualquer alteração retroativa em uma marcação já gravada quebra a
-- verificação da cadeia para quem vier depois.
ALTER TABLE registro_ponto
    ADD COLUMN hash_anterior VARCHAR(64),
    ADD COLUMN hash VARCHAR(64) NOT NULL;
