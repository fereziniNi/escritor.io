CREATE TABLE mapa (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    largura_tiles INT NOT NULL,
    altura_tiles INT NOT NULL,
    layout_json TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT false
);

-- PRD §3.5/§6: sem editor visual na v1 (fora de escopo) - o mapa é um JSON versionado no
-- repositório, definido à mão direto na migração, não criado por um formulário de admin.
INSERT INTO mapa (nome, largura_tiles, altura_tiles, layout_json, ativo)
VALUES ('Escritório', 20, 15, '{"paredes": []}', true);
