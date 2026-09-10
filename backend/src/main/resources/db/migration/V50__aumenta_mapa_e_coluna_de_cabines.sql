-- Pedido do usuário (feedback sobre a V49): "Não gostei. Aumente o espaço do escritório no geral.
-- Deixe as cabines na esquerda todas em coluna na vertical. Elas devem ter paredes e só é possível
-- entrar por um lado."
--
-- Mapa 28×20 -> 36×22: +8 de largura (6 pra abrir a coluna de cabines na borda esquerda + 2 de
-- respiro geral na direita), +2 de altura de folga geral (linhas extras no rodapé - nada existente
-- se move no eixo y).
UPDATE mapa SET largura_tiles = 36, altura_tiles = 22 WHERE ativo = true;

-- As 5 salas de sempre deslocam x += 6 (y/largura/altura intactos) - abre x[0,6) na borda esquerda
-- pra coluna de cabines + corredor. Mesmo cuidado de V23/V24: UPDATE por nome, não DELETE+INSERT
-- (evento_presenca tem FK NOT NULL pra zona(id) sem ON DELETE CASCADE).
UPDATE zona SET x = x + 6
WHERE nome IN ('Sala de reunião', 'Café', 'Happy Hour', 'Área de trabalho', 'Fora do trabalho')
  AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

-- As 3 cabines (linhas da V49) viram uma coluna vertical em x=1, cada uma 3×3 (espaço pra parede +
-- porta + cadeira sem ficar apertado), com 2 tiles de vão entre uma e a próxima. Porta de cada uma
-- na borda leste (voltada pro corredor/resto do escritório) - decidido no frontend
-- (gerarParedesDeZona), não precisa de coluna nova aqui.
UPDATE zona SET x = 1, y = 1, largura = 3, altura = 3
WHERE nome = 'Cabine 1' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET x = 1, y = 6, largura = 3, altura = 3
WHERE nome = 'Cabine 2' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET x = 1, y = 11, largura = 3, altura = 3
WHERE nome = 'Cabine 3' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);
