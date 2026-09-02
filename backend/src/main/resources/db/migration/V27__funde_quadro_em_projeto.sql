-- Pedido do cliente (via usuário): "não gostei, remova essa parte de quadro, vamos trabalhar
-- apenas com projeto" - Quadro deixa de existir como conceito separado. Projeto vira o próprio
-- quadro de trabalho: ganha colunas, cards, etiquetas e membros direto nele (membro_quadro vira
-- membro_projeto, e passa a ser a regra de visibilidade, herdada sem mudança do que já valia
-- pra quadro desde V26).

-- 1. Quadro sem projeto vinculado vira um projeto novo (usando o próprio nome do quadro), pra
--    nenhuma coluna/card/etiqueta ficar órfã quando coluna.projeto_id/etiqueta.projeto_id
--    virarem obrigatórios mais abaixo. Loop em vez de INSERT...SELECT em massa porque precisa
--    da correspondência 1:1 exata entre cada quadro e o projeto recém-criado pra ele (nomes de
--    quadro não são únicos, então não dá pra reconstruir esse pareamento por nome depois).
DO $$
DECLARE
    quadro_registro RECORD;
    novo_projeto_id BIGINT;
BEGIN
    FOR quadro_registro IN SELECT id, nome, criado_em FROM quadro WHERE projeto_id IS NULL LOOP
        INSERT INTO projeto (nome, cliente, status, inicio, fim_previsto)
        VALUES (quadro_registro.nome, 'Não informado', 'ATIVO', quadro_registro.criado_em::date, NULL)
        RETURNING id INTO novo_projeto_id;

        UPDATE quadro SET projeto_id = novo_projeto_id WHERE id = quadro_registro.id;
    END LOOP;
END $$;

-- 2. coluna: quadro_id -> projeto_id (todo quadro já tem projeto_id garantido pelo passo 1).
ALTER TABLE coluna ADD COLUMN projeto_id BIGINT REFERENCES projeto (id);
UPDATE coluna SET projeto_id = (SELECT projeto_id FROM quadro WHERE quadro.id = coluna.quadro_id);
ALTER TABLE coluna ALTER COLUMN projeto_id SET NOT NULL;
ALTER TABLE coluna DROP CONSTRAINT coluna_quadro_id_fkey;
ALTER TABLE coluna DROP CONSTRAINT uk_coluna_quadro_ordem;
ALTER TABLE coluna DROP COLUMN quadro_id;
ALTER TABLE coluna ADD CONSTRAINT uk_coluna_projeto_ordem UNIQUE (projeto_id, ordem);
-- idx_coluna_quadro já sumiu sozinho: Postgres derruba junto qualquer índice preso a uma coluna
-- quando ela é removida (DROP COLUMN quadro_id acima).
CREATE INDEX idx_coluna_projeto ON coluna (projeto_id);

-- 3. etiqueta: quadro_id -> projeto_id.
ALTER TABLE etiqueta ADD COLUMN projeto_id BIGINT REFERENCES projeto (id);
UPDATE etiqueta SET projeto_id = (SELECT projeto_id FROM quadro WHERE quadro.id = etiqueta.quadro_id);
ALTER TABLE etiqueta ALTER COLUMN projeto_id SET NOT NULL;
ALTER TABLE etiqueta DROP CONSTRAINT etiqueta_quadro_id_fkey;
ALTER TABLE etiqueta DROP COLUMN quadro_id;
-- idx_etiqueta_quadro: mesma explicação do coluna acima, já sumiu junto com o DROP COLUMN.
CREATE INDEX idx_etiqueta_projeto ON etiqueta (projeto_id);

-- 4. membro_quadro -> membro_projeto (mesma forma, só troca quem é o dono da atribuição).
CREATE TABLE membro_projeto (
    id BIGSERIAL PRIMARY KEY,
    projeto_id BIGINT NOT NULL REFERENCES projeto (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_membro_projeto_projeto_usuario UNIQUE (projeto_id, usuario_id)
);

INSERT INTO membro_projeto (projeto_id, usuario_id, criado_em)
SELECT quadro.projeto_id, membro_quadro.usuario_id, membro_quadro.criado_em
FROM membro_quadro
JOIN quadro ON quadro.id = membro_quadro.quadro_id
-- um usuário pode ter sido membro de mais de um quadro que virou o mesmo projeto (ex.: dois
-- quadros órfãos com o mesmo dono, hoje dois projetos - improvável, mas a UNIQUE de destino
-- rejeitaria duplicata sem isto).
ON CONFLICT (projeto_id, usuario_id) DO NOTHING;

CREATE INDEX idx_membro_projeto_usuario ON membro_projeto (usuario_id);
CREATE INDEX idx_membro_projeto_projeto ON membro_projeto (projeto_id);

DROP TABLE membro_quadro;

-- 5. quadro não existe mais - projeto é o próprio quadro agora.
DROP TABLE quadro;
