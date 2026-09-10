-- Pedido do usuário: "cabines fechadas para caso os usuários não possam e não queiram escutar o
-- barulho da sala" - novo tipo de zona (ver ck_zona_tipo abaixo) tratado de forma especial no
-- pareamento de voz por proximidade (frontend, `mundo/proximidade.ts`): só quem está DENTRO da
-- mesma cabine se ouve, ninguém de fora ouve/é ouvido, mesmo perto o bastante pro raio normal.
ALTER TABLE zona DROP CONSTRAINT ck_zona_tipo;
ALTER TABLE zona ADD CONSTRAINT ck_zona_tipo
    CHECK (tipo IN ('FOCO', 'REUNIAO', 'CAFE', 'ATENDIMENTO', 'LIVRE', 'HAPPY_HOUR', 'CABINE'));

-- 3 cabines 2×2, em espaços livres do mapa 28×20 (V24__redesenha_salas_por_funcao.sql /
-- V46__happy_hour.sql) - sem sobrepor nenhuma sala nem a mobília existente (dadosMundo.ts, só
-- frontend):
-- Cabine 1/2: corredor entre Sala de reunião (x1-8,y1-7) e Café (x13-19,y1-7), uma embaixo da
-- outra.
-- Cabine 3: corredor entre Área de trabalho (x1-13,y10-18) e Fora do trabalho (x16-26,y10-18).
INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Cabine 1', 10, 1, 2, 2, 'CABINE' FROM mapa WHERE ativo = true;

INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Cabine 2', 10, 4, 2, 2, 'CABINE' FROM mapa WHERE ativo = true;

INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Cabine 3', 13, 13, 2, 2, 'CABINE' FROM mapa WHERE ativo = true;
